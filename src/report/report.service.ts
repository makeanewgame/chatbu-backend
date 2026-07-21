import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { EventsGateway } from 'src/events/events.gateway';
import axios from 'axios';

@Injectable()
export class ReportService {
    constructor(
        private prisma: PrismaService,
        private minioClientService: MinioClientService,
        private configService: ConfigService,
        private eventsGateway: EventsGateway,
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

    async getChatHistoryDetail(teamId: string, chatId: string) {

        const chatHistoryList = await this.prisma.customerChats.findFirst({
            where: {
                teamId: teamId,
                id: chatId,
            },
            select: {
                CustomerChatDetails: {
                    where: {
                        chatId: chatId,
                    },
                    select: {
                        message: true,
                        createdAt: true,
                        sender: true,
                        id: true,
                        attachments: true,
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

        console.log(geoLocation);

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
        await this.prisma.customerChatDetails.create({
            data: {
                chatId: chat.id,
                sender: 'agent',
                message,
                createdAt: new Date(),
            },
        });

        await this.prisma.customerChats.update({
            where: { id: chat.id },
            data: { updatedAt: new Date() },
        });

        // Kanala göre yönlendir
        const agentUser = await this.prisma.user.findUnique({
            where: { id: agentUserId },
            select: { name: true },
        });
        const agentName = agentUser?.name ? agentUser.name.trim().split(' ')[0] : undefined;

        if (chat.channel === 'WHATSAPP' || chat.channel === 'META_MESSENGER') {
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
            data: { chatStatus: 'CLOSED', updatedAt: new Date() },
        });

        // Widget'a bilgi ver ki geri bildirim paneli açılabilsin. Widget hangi
        // id ile odaya katıldıysa yakalasın diye hem chat.id hem chat.chatId
        // odalarına gönderiyoruz — sendAgentMessage'daki desenle aynı.
        // Temporary diagnostic — remove once the 2026-07-10 "agent closed
        // chat but no feedback panel appeared" report is root-caused.
        console.log('[closeChat] emitting chat_ended', { id: chat.id, chatId: chat.chatId });
        this.eventsGateway.notifyChatEnded(chat.id, { chatId: chat.id, reason: 'agent_closed' });
        this.eventsGateway.notifyChatEnded(chat.chatId, { chatId: chat.chatId, reason: 'agent_closed' });

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

            await axios.post(
                `https://graph.facebook.com/v23.0/me/messages`,
                {
                    recipient: { id: chat.externalContactId },
                    message: { text: message },
                },
                { params: { access_token: pageAccessToken } },
            );
        }
    }
}
