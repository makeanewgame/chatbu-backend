import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { EventsGateway } from 'src/events/events.gateway';
import { HandoffNotificationService } from 'src/handoff/handoff-notification.service';
import { MetaSentRegistryService } from 'src/meta-sent-registry/meta-sent-registry.service';
import { collectConversationRowIds } from './conversation-merge.util';
import { formatAgentPublicName } from 'src/util/agent-name.util';
import { ConversationBroadcastService } from 'src/events/conversation-broadcast.service';
import {
    buildConversationCard,
    compareConversationCards,
    isLiveStatus,
    LIVE_STATUSES,
} from 'src/events/conversation-card.util';
import { FlowKind } from '../../generated/prisma/client';
import axios from 'axios';

@Injectable()
export class ReportService {
    constructor(
        private prisma: PrismaService,
        private minioClientService: MinioClientService,
        private configService: ConfigService,
        private eventsGateway: EventsGateway,
        private handoffNotificationService: HandoffNotificationService,
        private metaSentRegistry: MetaSentRegistryService,
        private conversationBroadcast: ConversationBroadcastService,
    ) { }

    async getChatHistory(teamId: string) {


        const chatHistoryList = await this.prisma.customerChats.findMany({
            where: {
                teamId: teamId,
                isDeleted: false,
            },
            select: {
                id: true,
                chatId: true,
                teamId: true,
                createdAt: true,
                updatedAt: true,
                totalTokens: true,
                chatStatus: true,
                channel: true,
                externalContactId: true,
                externalContactName: true,
                agentUserId: true,
                agent: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                botId: true,
                feedbackRating: true,
                CustomerChatDetails: {
                    where: {
                        sender: "user",
                    },
                    take: 1,
                    orderBy: {
                        createdAt: "desc",
                    },
                    select: {
                        message: true,
                        createdAt: true
                    }
                },
                GeoLocation: {
                    select: {
                        country: true,
                        city: true,
                    }
                }
            },
        });

        if (!chatHistoryList) {
            return {
                message: 'No chat history found',
                data: [],
            }
        }

        // ChatFeedback isn't a formal Prisma relation on CustomerChats (it's
        // only linked by the shared `chatId` string), so the written comment
        // behind a "Kısmen"/"Hayır" rating has to be joined manually here —
        // batch-fetched once for the whole list rather than N+1 queries.
        const feedbackChatIds = chatHistoryList
            .map((chat) => chat.chatId)
            .filter((chatId): chatId is string => !!chatId);

        const feedbackComments = feedbackChatIds.length
            ? await this.prisma.chatFeedback.findMany({
                where: { chatId: { in: feedbackChatIds } },
                orderBy: { createdAt: 'desc' },
                select: { chatId: true, comment: true },
            })
            : [];

        // Most recent comment wins if a chat somehow has more than one feedback row.
        const commentByChatId = new Map<string, string | null>();
        for (const fb of feedbackComments) {
            if (fb.chatId && !commentByChatId.has(fb.chatId)) {
                commentByChatId.set(fb.chatId, fb.comment ?? null);
            }
        }

        return chatHistoryList.map((chat) => ({
            ...chat,
            feedbackComment: chat.chatId ? commentByChatId.get(chat.chatId) ?? null : null,
        }));
    }

    // ── Unified "Sohbetler" inbox: canlı + geçmiş tek liste ──────────────────
    // Replaces the split getChatHistory (tab: Görüşmeler) + getLiveChats (tab:
    // Canlı Görüşmeler). Three-tier ordering (live → open → closed, then by most
    // recent activity) is done in JS because it can't be expressed in a single
    // Prisma orderBy. `filter` narrows by ChatStatus group; `search` matches the
    // contact name / external id.
    async getConversations(
        teamId: string,
        opts: {
            filter?: 'all' | 'live' | 'ai' | 'closed';
            page?: number;
            pageSize?: number;
            search?: string;
            startDate?: string;
            endDate?: string;
            channels?: string[];
            agentIds?: string[];
            hasRating?: boolean;
            minRating?: number;
            country?: string;
            city?: string;
        } = {},
    ) {
        const filter = opts.filter ?? 'all';
        const page = Math.max(1, opts.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
        const search = opts.search?.trim();

        const where: any = { teamId, isDeleted: false };
        if (filter === 'live') where.chatStatus = { in: LIVE_STATUSES };
        else if (filter === 'ai') where.chatStatus = 'BOT_ACTIVE';
        else if (filter === 'closed') where.chatStatus = 'CLOSED';

        // Independent OR-groups (search, agent) are kept in separate `AND`
        // entries rather than merged into one `where.OR`, so they combine as
        // (search) AND (agent) instead of collapsing into (search OR agent).
        const andGroups: any[] = [];
        if (search) {
            andGroups.push({
                OR: [
                    { externalContactName: { contains: search, mode: 'insensitive' } },
                    { externalContactId: { contains: search, mode: 'insensitive' } },
                    { chatId: { contains: search, mode: 'insensitive' } },
                ],
            });
        }

        if (opts.startDate || opts.endDate) {
            where.createdAt = {};
            if (opts.startDate) where.createdAt.gte = new Date(`${opts.startDate}T00:00:00.000Z`);
            if (opts.endDate) where.createdAt.lte = new Date(`${opts.endDate}T23:59:59.999Z`);
        }

        if (opts.channels?.length) {
            where.channel = { in: opts.channels };
        }

        if (opts.agentIds?.length) {
            const wantsUnassigned = opts.agentIds.includes('unassigned');
            const ids = opts.agentIds.filter((id) => id !== 'unassigned');
            if (wantsUnassigned && ids.length) {
                andGroups.push({ OR: [{ agentUserId: { in: ids } }, { agentUserId: null }] });
            } else if (wantsUnassigned) {
                where.agentUserId = null;
            } else if (ids.length) {
                where.agentUserId = { in: ids };
            }
        }

        if (andGroups.length) where.AND = andGroups;

        if (opts.hasRating === true) {
            where.feedbackRating = opts.minRating ? { gte: opts.minRating } : { not: null };
        } else if (opts.hasRating === false) {
            where.feedbackRating = null;
        } else if (opts.minRating) {
            where.feedbackRating = { gte: opts.minRating };
        }

        if (opts.country?.trim() || opts.city?.trim()) {
            where.GeoLocation = {
                some: {
                    ...(opts.country?.trim() ? { country: { contains: opts.country.trim(), mode: 'insensitive' } } : {}),
                    ...(opts.city?.trim() ? { city: { contains: opts.city.trim(), mode: 'insensitive' } } : {}),
                },
            };
        }

        // Safety cap — a cursor-paginated variant is a follow-up if a team ever
        // outgrows this. The old getChatHistory already loaded the whole table
        // unbounded, so this is strictly better.
        const rows = await this.prisma.customerChats.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 2000,
            select: {
                id: true,
                chatId: true,
                teamId: true,
                botId: true,
                channel: true,
                chatStatus: true,
                agentUserId: true,
                agentUnreadCount: true,
                externalContactName: true,
                externalContactId: true,
                createdAt: true,
                feedbackRating: true,
                agent: { select: { name: true } },
                CustomerChatDetails: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { sender: true, message: true, createdAt: true },
                },
                GeoLocation: { take: 1, select: { country: true, city: true } },
            },
        });

        const cards = rows
            .map((row) => {
                const card = buildConversationCard(row as any);
                const geo = row.GeoLocation?.[0] ?? null;
                return {
                    ...card,
                    createdAt: row.createdAt.toISOString(),
                    feedbackRating: row.feedbackRating ?? null,
                    geo: geo ? { country: geo.country, city: geo.city } : null,
                };
            })
            .sort(compareConversationCards);

        const total = cards.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const items = cards.slice((page - 1) * pageSize, page * pageSize);

        return { items, total, page, pageSize, totalPages };
    }

    // ── Conversation detail for the middle panel: messages (attachment-presigned
    // via getChatHistoryDetail) + card meta + a "Son Etkinlik" activity list
    // sourced from PerChatFlowState (LEAD / BOOKING / HANDOFF / FEEDBACK). ─────
    async getConversationDetail(teamId: string, chatId: string) {
        const messages = await this.getChatHistoryDetail(teamId, chatId);

        const row = await this.prisma.customerChats.findFirst({
            where: { teamId, OR: [{ id: chatId }, { chatId: chatId }] },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                chatId: true,
                botId: true,
                channel: true,
                chatStatus: true,
                agentUserId: true,
                agentUnreadCount: true,
                totalTokens: true,
                feedbackRating: true,
                externalContactName: true,
                externalContactId: true,
                createdAt: true,
                agent: { select: { name: true } },
                GeoLocation: { take: 1, select: { country: true, city: true, region: true } },
                CustomerChatDetails: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true },
                },
            },
        });

        if (!row) {
            return { ...messages, meta: null, activity: [] };
        }

        const feedback = await this.prisma.chatFeedback.findFirst({
            where: { chatId: row.chatId, botId: row.botId },
            orderBy: { createdAt: 'desc' },
            select: { comment: true },
        });

        const flowStates = await this.prisma.perChatFlowState.findMany({
            where: { chatId: row.chatId, botId: row.botId },
            orderBy: { updatedAt: 'asc' },
            select: { flowKind: true, state: true, updatedAt: true, payload: true },
        });

        const activity = flowStates
            .map((fs) => {
                const at = fs.updatedAt.toISOString();
                const payload = (fs.payload ?? {}) as Record<string, any>;
                switch (fs.flowKind) {
                    case FlowKind.BOOKING:
                        if (fs.state !== 'BOOKED') return null;
                        return { type: 'BOOKING', state: fs.state, at, meta: { startIso: payload.start_iso ?? null, appointmentId: payload.appointment_id ?? null } };
                    case FlowKind.LEAD:
                        if (fs.state !== 'SUBMITTED') return null;
                        return { type: 'LEAD', state: fs.state, at, meta: null };
                    case FlowKind.HANDOFF:
                        if (fs.state !== 'REQUESTED' && fs.state !== 'ASSIGNED') return null;
                        return { type: 'HANDOFF', state: fs.state, at, meta: null };
                    case FlowKind.FEEDBACK:
                        if (fs.state !== 'SUBMITTED') return null;
                        return { type: 'FEEDBACK', state: fs.state, at, meta: null };
                    default:
                        return null;
                }
            })
            .filter(Boolean);

        const geo = row.GeoLocation?.[0] ?? null;
        const meta = {
            id: row.id,
            chatId: row.chatId,
            botId: row.botId,
            channel: row.channel,
            chatStatus: row.chatStatus,
            isLive: isLiveStatus(row.chatStatus),
            unreadCount: isLiveStatus(row.chatStatus) ? row.agentUnreadCount ?? 0 : 0,
            contactName: row.externalContactName ?? null,
            contactId: row.externalContactId ?? null,
            firstContactAt: row.createdAt.toISOString(),
            lastMessageAt: row.CustomerChatDetails?.[0]?.createdAt?.toISOString() ?? null,
            assignedAgentId: row.agentUserId ?? null,
            assignedAgentName: row.agent?.name ?? null,
            totalTokens: row.totalTokens ?? 0,
            feedbackRating: row.feedbackRating ?? null,
            feedbackComment: feedback?.comment ?? null,
            geo: geo ? { country: geo.country, city: geo.city, region: geo.region } : null,
        };

        return { ...messages, meta, activity };
    }

    // ── Agent opened the conversation → clear its unread counter + fan out a
    // read receipt so the agent's other devices update too. ──────────────────
    async markConversationRead(teamId: string, chatId: string, userId: string) {
        const row = await this.prisma.customerChats.findFirst({
            where: { teamId, OR: [{ id: chatId }, { chatId: chatId }] },
            select: { id: true },
        });
        if (!row) {
            throw new NotFoundException('Chat not found');
        }
        await this.conversationBroadcast.markRead(row.id, userId);
        return { success: true, unreadCount: 0 };
    }

    async getChatHistoryDetail(teamId: string, chatId: string) {

        // `chatId` here is either a CustomerChats PK (chat-history table links)
        // or a gateway session id string (lead "view conversation" links, which
        // only know botLeads.chatId). Match either — PK first so an exact row
        // wins when both could resolve.
        const targetRow = await this.prisma.customerChats.findFirst({
            where: {
                teamId: teamId,
                OR: [{ id: chatId }, { chatId: chatId }],
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                teamId: true,
                botId: true,
                chatId: true,
                channel: true,
                externalContactId: true,
                externalContactName: true,
                createdAt: true,
            },
        });

        if (!targetRow) {
            return {
                message: 'No chat history found',
                data: [],
            }
        }

        // A single visitor conversation can be split across multiple
        // CustomerChats rows (pre-fix widget bursts, races). Pull every
        // sibling row that belongs to the same logical conversation so the
        // detail view shows the whole thing, not one fragment.
        const rowIds = await collectConversationRowIds(this.prisma, targetRow);

        const details = await this.prisma.customerChatDetails.findMany({
            where: { chatId: { in: rowIds } },
            orderBy: { createdAt: 'asc' },
            select: {
                message: true,
                createdAt: true,
                sender: true,
                id: true,
                attachments: true,
            },
        });

        const chatHistoryList = {
            channel: targetRow.channel,
            externalContactId: targetRow.externalContactId,
            externalContactName: targetRow.externalContactName,
            mergedSessionCount: rowIds.length,
            CustomerChatDetails: details,
        };

        const bucket = this.configService.get('S3_BUCKET_NAME');

        // Enrich attachments with fresh presigned URLs
        const enrichedDetails = await Promise.all(
            chatHistoryList.CustomerChatDetails.map(async (detail) => {
                if (!detail.attachments || !Array.isArray(detail.attachments)) {
                    return detail;
                }

                const enrichedAttachments = await Promise.all(
                    (detail.attachments as any[]).map(async (att) => {
                        if (!att.objectPath) return att;

                        // Check if the storage record is deleted
                        const storageRecord = att.storageId
                            ? await this.prisma.storage.findFirst({
                                where: { id: att.storageId },
                                select: { isDeleted: true },
                            })
                            : null;

                        if (storageRecord?.isDeleted) {
                            return {
                                storageId: att.storageId,
                                fileName: att.fileName,
                                fileType: att.fileType,
                                size: att.size,
                                deleted: true,
                            };
                        }

                        try {
                            const presignedUrl = await this.minioClientService.getPresignedUrl(att.objectPath, bucket);
                            return { ...att, presignedUrl, deleted: false };
                        } catch {
                            return { ...att, deleted: true };
                        }
                    }),
                );

                return { ...detail, attachments: enrichedAttachments };
            }),
        );

        return { ...chatHistoryList, CustomerChatDetails: enrichedDetails };
    }

    async getUserUsage(teamId: string) {
        const userUsage = await this.prisma.quota.findMany({
            where: {
                teamId: teamId,
            },
            select: {
                id: true,
                quotaType: true,
                limit: true,
                used: true,
            }
        });

        const team = await this.prisma.team.findFirst({
            where: {
                id: teamId,
            },
            select: {
                ownerId: true,
            }
        });

        const tokenUsage = await this.prisma.subscription.findFirst({
            where: {
                userId: team?.ownerId,
            },
            select: {
                tokensUsedThisMonth: true,
                monthlyTokenAllocation: true,
            }
        });

        userUsage.push({
            id: 'token-usage',
            quotaType: 'TOKEN',
            limit: tokenUsage?.monthlyTokenAllocation || 0,
            used: tokenUsage?.tokensUsedThisMonth || 0,
        })

        if (!userUsage) {
            return {
                message: 'No user found',
                data: [],
            }
        }
        return userUsage;
    }

    async getChatRequestsByUser(user: string) {
        // const chatRequests = await this.prisma.geoLocation.findMany({
        //     where: {
        //         userId: user,
        //     },
        //     select: {
        //         id: true,
        //         userId: true,
        //         createdAt: true,
        //         updatedAt: true,
        //         CustomerChatRequestDetails: {
        //             where: {
        //                 sender: "user",
        //             },
        //             take: 1,
        //             orderBy: {
        //                 createdAt: "desc",
        //             },
        //             select: {
        //                 message: true,
        //                 createdAt: true
        //             }
        //         },
        //     },
        // });

        // if (!chatRequests) {
        //     return {
        //         message: 'No chat requests found',
        //         data: [],
        //     }
        // }

        return "ok";
    }

    async getGeoLocations(teamId: string) {
        const geoLocation = await this.prisma.customerChats.findMany({
            where: {
                teamId: teamId,
            },
            select: {
                id: true,
                GeoLocation: {
                    select: {
                        country: true,
                        city: true,
                        region: true,
                        latitude: true,
                        longitude: true,
                        ip: true,
                    }
                }
            }

        });

        if (!geoLocation) {
            return {
                message: 'No geo location found',
                data: [],
            }
        }

        return geoLocation;
    }

    async getTokenUsageDetails(teamId: string, startDate?: string, endDate?: string, botId?: string, operationType?: string) {
        const team = await this.prisma.team.findFirst({
            where: { id: teamId },
            select: { ownerId: true },
        });

        if (!team) {
            return { logs: [], summary: {} };
        }

        const subscription = await this.prisma.subscription.findFirst({
            where: { userId: team.ownerId },
            select: { id: true },
        });

        if (!subscription) {
            return { logs: [], summary: {} };
        }

        const where: any = { subscriptionId: subscription.id };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }
        if (botId) where.botId = botId;
        if (operationType) where.operationType = operationType;

        const logs = await this.prisma.tokenUsageLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 500,
        });

        // Summary by operation type
        const summary = await this.prisma.tokenUsageLog.groupBy({
            by: ['operationType'],
            where: { subscriptionId: subscription.id },
            _sum: { tokensUsed: true, cost: true },
            _count: true,
        });

        return { logs, summary };
    }

    // ── Handover: sohbeti bir ajana aktar ────────────────────────────────────
    async handoverChat(teamId: string, chatId: string, agentUserId: string) {
        if (!agentUserId || agentUserId === 'undefined') {
            throw new BadRequestException('agentUserId is required');
        }

        const chat = await this.prisma.customerChats.findFirst({
            where: { id: chatId, teamId, isDeleted: false },
        });

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        const agent = await this.prisma.user.findUnique({
            where: { id: agentUserId },
            select: { id: true },
        });

        if (!agent) {
            throw new NotFoundException('Agent user not found');
        }

        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            select: { ownerId: true },
        });

        const isTeamOwner = team?.ownerId === agentUserId;

        // Ajana ait kullanıcı aynı takımda mı kontrol et
        const agentMembership = await this.prisma.teamMember.findFirst({
            where: { teamId, userId: agentUserId, status: 'active' },
        });

        if (!isTeamOwner && !agentMembership) {
            throw new ForbiddenException('Agent is not a member of this team');
        }

        const updated = await this.prisma.customerChats.update({
            where: { id: chat.id },
            data: {
                chatStatus: 'HUMAN_ACTIVE',
                agentUserId,
            },
        });

        // Tell the agent the chat is now theirs (socket + push + email).
        // Manual handover used to be completely silent — the target agent
        // got no signal at all unless they happened to be staring at the
        // live-chat list. Best-effort: a notification failure must not
        // fail the handover itself.
        try {
            const bot = await this.prisma.customerBots.findUnique({
                where: { id: chat.botId },
                select: { botName: true, primaryLanguage: true },
            });
            await this.handoffNotificationService.notifyAssignee({
                chatRowId: chat.id,
                agentUserId,
                botName: bot?.botName ?? 'Chatbu',
                botPrimaryLanguage: bot?.primaryLanguage ?? null,
            });
        } catch (notifyError) {
            console.log('[handoverChat] assignee notification failed:', notifyError);
        }

        return { success: true, chat: updated };
    }

    // ── Live chats: ajana atanmış aktif sohbetler ────────────────────────────
    async getLiveChats(agentUserId: string) {
        const chats = await this.prisma.customerChats.findMany({
            where: {
                agentUserId,
                chatStatus: 'HUMAN_ACTIVE',
                isDeleted: false,
            },
            select: {
                id: true,
                botId: true,
                teamId: true,
                chatId: true,
                channel: true,
                externalContactId: true,
                createdAt: true,
                updatedAt: true,
                CustomerChatDetails: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { message: true, sender: true, createdAt: true },
                },
                GeoLocation: {
                    take: 1,
                    select: { country: true, city: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        return chats;
    }

    // ── Agent message: ajandan müşteriye mesaj gönder ────────────────────────
    async sendAgentMessage(teamId: string, chatId: string, agentUserId: string, message: string) {
        const chat = await this.prisma.customerChats.findFirst({
            where: { id: chatId, teamId, isDeleted: false },
        });

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        if (chat.agentUserId !== agentUserId) {
            throw new ForbiddenException('You are not assigned to this chat');
        }

        if (chat.chatStatus !== 'HUMAN_ACTIVE') {
            throw new BadRequestException('Chat is not in human-active state');
        }

        // Mesajı veritabanına kaydet
        const agentDetail = await this.prisma.customerChatDetails.create({
            data: {
                chatId: chat.id,
                sender: 'agent',
                message,
                createdAt: new Date(),
            },
        });

        // Agent replied — clear the unread counter for the whole team's inbox.
        await this.prisma.customerChats.update({
            where: { id: chat.id },
            data: { updatedAt: new Date(), agentUnreadCount: 0, agentLastReadAt: new Date() },
        });

        // Kanala göre yönlendir
        const agentUser = await this.prisma.user.findUnique({
            where: { id: agentUserId },
            select: { name: true },
        });
        // Visitor-facing: full first name + surname initial ("Ahmet E.").
        // Dashboards/records still use the agent's full name.
        const agentName = formatAgentPublicName(agentUser?.name);

        if (chat.channel === 'WHATSAPP' || chat.channel === 'META_MESSENGER' || chat.channel === 'INSTAGRAM') {
            await this.deliverToExternalChannel(chat, message);
        } else {
            // Widget: WebSocket üzerinden müşteriye ilet
            this.eventsGateway.notifyCustomer(chat.id, {
                chatId: chat.id,
                sender: 'agent',
                message,
                agentName,
                createdAt: new Date().toISOString(),
            });
            this.eventsGateway.notifyCustomer(chat.chatId, {
                chatId: chat.chatId,
                sender: 'agent',
                message,
                agentName,
                createdAt: new Date().toISOString(),
            });
        }

        // Birleşik inbox: agent mesajını + sıfırlanan unread'i takıma yayınla.
        void this.conversationBroadcast.broadcast(chat.id, {
            messages: [
                {
                    id: agentDetail.id,
                    sender: 'agent',
                    text: message,
                    createdAt: agentDetail.createdAt,
                    agentName,
                },
            ],
        });

        return { success: true };
    }

    // ── Close chat ───────────────────────────────────────────────────────────
    async closeChat(teamId: string, chatId: string, agentUserId: string) {
        const chat = await this.prisma.customerChats.findFirst({
            where: { id: chatId, teamId, isDeleted: false },
        });

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        if (chat.agentUserId !== agentUserId) {
            throw new ForbiddenException('You are not assigned to this chat');
        }

        await this.prisma.customerChats.update({
            where: { id: chat.id },
            data: { chatStatus: 'CLOSED', updatedAt: new Date(), agentUnreadCount: 0 },
        });

        // Widget'a bilgi ver ki geri bildirim paneli açılabilsin. Widget hangi
        // id ile odaya katıldıysa yakalasın diye hem chat.id hem chat.chatId
        // odalarına gönderiyoruz — sendAgentMessage'daki desenle aynı.
        // Temporary diagnostic — remove once the 2026-07-10 "agent closed
        // chat but no feedback panel appeared" report is root-caused.
        console.log('[closeChat] emitting chat_ended', { id: chat.id, chatId: chat.chatId });
        this.eventsGateway.notifyChatEnded(chat.id, { chatId: chat.id, reason: 'agent_closed' });
        this.eventsGateway.notifyChatEnded(chat.chatId, { chatId: chat.chatId, reason: 'agent_closed' });

        // Birleşik inbox: konuşma kapalı grubuna insin, canlı ikon kalksın.
        void this.conversationBroadcast.broadcast(chat.id, { reason: 'closed' });

        return { success: true };
    }

    // ── Delete chat (soft delete) ────────────────────────────────────────────
    async deleteChat(teamId: string, chatId: string) {
        const chat = await this.prisma.customerChats.findFirst({
            where: { id: chatId, teamId, isDeleted: false },
        });

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        await this.prisma.customerChats.update({
            where: { id: chat.id },
            data: { isDeleted: true, deletedAt: new Date() },
        });

        return { success: true };
    }

    // ── Harici kanal teslimi (WhatsApp / Meta Messenger / Instagram) ────────
    private async deliverToExternalChannel(chat: any, message: string) {
        // Kanala göre entegrasyon tiplerini daralt — aksi halde aynı bota bağlı
        // birden fazla kanal (ör. Messenger + Instagram) varken yanlış config
        // seçilebilir.
        const typesByChannel: Record<string, string[]> = {
            WHATSAPP: ['whatsapp_embedded', 'whatsapp_manual', 'whatsapp'],
            META_MESSENGER: ['metabusiness_embedded', 'metabusiness'],
            INSTAGRAM: ['instagram_embedded', 'instagram'],
        };
        const candidateTypes = typesByChannel[chat.channel];

        if (!candidateTypes) return;

        const integrations = await this.prisma.integrations.findMany({
            where: {
                teamId: chat.teamId,
                type: { in: candidateTypes },
                config: { path: ['botId'], equals: chat.botId },
            },
        });
        // Embedded (OAuth) bağlantı varsa onu tercih et, yoksa manuel olana düş.
        const integration = integrations.find((i) => i.type.endsWith('_embedded')) ?? integrations[0];

        if (!integration) {
            throw new NotFoundException('No integration found for this bot');
        }

        const cfg = integration.config as any;

        if (chat.channel === 'WHATSAPP') {
            const phoneNumberId: string = cfg?.phoneNumberId;
            const accessToken: string = cfg?.businessToken ?? cfg?.accessToken;

            if (!phoneNumberId || !accessToken || !chat.externalContactId) {
                throw new BadRequestException('Missing WhatsApp config or contact ID');
            }

            await axios.post(
                `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: chat.externalContactId,
                    type: 'text',
                    text: { body: message },
                },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
        } else if (chat.channel === 'META_MESSENGER' || chat.channel === 'INSTAGRAM') {
            const pageAccessToken: string = cfg?.pageAccessToken;

            if (!pageAccessToken || !chat.externalContactId) {
                throw new BadRequestException(`Missing ${chat.channel} config or contact ID`);
            }

            const { data } = await axios.post(
                `https://graph.facebook.com/v23.0/me/messages`,
                {
                    recipient: { id: chat.externalContactId },
                    message: { text: message },
                },
                { params: { access_token: pageAccessToken } },
            );
            // Dashboard agent sends echo back on the webhook like any
            // page-sent message — record the mid so the owner-echo
            // takeover handler (meta.service.handleOwnerEcho) doesn't
            // mistake our own send for a manual owner reply and mirror
            // it into the transcript a second time.
            await this.metaSentRegistry.record(data?.message_id);
        }
    }
}
