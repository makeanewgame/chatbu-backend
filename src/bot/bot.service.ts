import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBotRequest } from './dto/createBotRequest';
import { DeleteBotRequest } from './dto/deleteBotRequest';
import { UpdateSettingsRequest } from './dto/updateSettingsRequest';
import { ChageStatusBotRequest } from './dto/changeStatusBotRequest';
import { RenameBotRequest } from './dto/renameBotRequest';
import { ChatRequest } from './dto/chatRequest';
import { GenerateSystemPromptRequest } from './dto/generateSystemPromptRequest';
import { MODEL_TIERS, DEFAULT_MODEL_TIER } from './model-tier.constants';
import { UpdateModelTierRequest } from './dto/updateModelTierRequest';
import { UpdateLeadDestinationsRequest } from './dto/updateLeadDestinationsRequest';
import { UpdateLeadVerificationRequest } from './dto/updateLeadVerificationRequest';
import { UpdateSmsVerificationRequest } from './dto/updateSmsVerificationRequest';
import { UpdateStreamingEnabledRequest } from './dto/updateStreamingEnabledRequest';
import { catchError, firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { Response } from 'express';
import { Readable } from 'stream';
import { SseFrameParser } from './sse-frame-parser';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionService } from '../subscription/subscription.service';
import { MailService } from '../mail/mail.service';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { SystemLogService } from 'src/system-log/system-log.service';
import { EventsGateway } from 'src/events/events.gateway';
import { DEFAULT_WORKING_HOURS } from 'src/appointment/appointment.constants';
import { ChatFlowService } from 'src/chat-flow/chat-flow.service';
import { FlowKind } from '../../generated/prisma/client';
import { PushNotificationService } from 'src/push-notification/push-notification.service';

@Injectable()
export class BotService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private subscriptionService: SubscriptionService,
    private mailService: MailService,
    private minioClientService: MinioClientService,
    private systemLogService: SystemLogService,
    private eventsGateway: EventsGateway,
    private chatFlowService: ChatFlowService,
    private pushNotificationService: PushNotificationService,
  ) { }

  async createBot(body: CreateBotRequest, userId?: string, userEmail?: string) {
    const user = await this.prisma.team.findUnique({
      where: {
        id: body.user,
      },
    });

    if (!user) {
      throw new Error('Error acuring user');
    }

    //bot quota for user

    const bots = await this.prisma.customerBots.findMany({
      where: {
        teamId: body.user,
        isDeleted: false,
      },
    });

    console.log('user bots  -->', bots);

    const botQuota = await this.prisma.quota.findFirst({
      where: {
        teamId: body.user,
        quotaType: 'BOT',
      },
    });

    console.log('bot quota  -->', botQuota);

    if (botQuota) {
      if (bots.length >= botQuota.limit) {
        throw new ForbiddenException('Bot quota exceeded');
      } else if (bots.length < botQuota.limit) {
        console.log('bot creation...', body.systemPrompt);
        console.log('bot creation...', body.settings);


        const bot = await this.prisma.customerBots.create({
          data: {
            botName: body.botName,
            botAvatar: body.botAvatar.toString(),
            systemPrompt: body.systemPrompt,
            settings: body.settings,
            purpose: body.purpose,
            active: true,
            appointmentWorkingHours: DEFAULT_WORKING_HOURS as any,
            team: {
              connect: {
                id: body.user,
              },
            },
          },
        });

        if (bot) {
          await this.prisma.quota.update({
            where: {
              id: botQuota.id,
            },
            data: {
              used: botQuota.used + 1,
            },
          });

          await this.systemLogService.createLog({
            category: 'BOT',
            action: 'CREATE',
            status: 'SUCCESS',
            userId,
            userEmail,
            teamId: body.user,
            entityId: bot.id,
            entityName: body.botName,
            message: `Bot created: ${body.botName}`,
          });

          return { message: 'Bot created', botId: bot.id };
        }
        throw new Error('Error creating bot');
      }
    }
    throw new ForbiddenException('Error creating bot');
  }

  async generateSystemPrompt(body: GenerateSystemPromptRequest) {
    const ingestUrl = this.configService.get('INGEST_ENPOINT');

    const team = await this.prisma.team.findUnique({
      where: { id: body.teamId },
      include: { owner: true },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const quotaCheck = await this.subscriptionService.checkTokenQuota(team.ownerId, {
      teamId: body.teamId,
      entityId: body.botId,
      entityName: body.businessName,
    });
    if (!quotaCheck.allowed) {
      throw new ForbiddenException(quotaCheck.message || 'Token quota exceeded');
    }

    let data: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${ingestUrl}/generate-system-prompt`, {
          business_name: body.businessName,
          company_size: body.companySize,
          industry: body.industry,
          website: body.website,
          purpose: body.purpose,
          language: body.language,
          page_summaries: body.pageSummaries,
        }).pipe(
          catchError((error: AxiosError) => {
            console.log('generateSystemPrompt error', error.message);
            throw error;
          }),
        ));
      data = response.data;
    } catch (error) {
      throw new BadRequestException('Could not generate a system prompt right now, please try again');
    }

    // Bill the draft's token usage the same way a chat turn is billed —
    // the gateway call above runs a real LLM invocation, it just wasn't
    // metered before this. `tokens` is only present once the ML gateway
    // reports it; older/unpatched gateway pods silently produce a 0-token
    // (unbilled) log row rather than failing the request.
    const tokenCount = data.tokens?.total_tokens || 0;
    if (tokenCount > 0) {
      await this.subscriptionService.trackTokenUsage(
        team.ownerId,
        tokenCount,
        body.teamId,
        body.botId,
        undefined,
        'system_prompt',
      );
    }

    return {
      systemPrompt: data.system_prompt,
      tone: data.tone,
      guidelines: data.guidelines,
    };
  }

  async deleteBot(body: DeleteBotRequest, userId?: string, userEmail?: string) {
    const findUser = await this.prisma.team.findUnique({
      where: {
        id: body.teamId,
      },
    });

    if (!findUser) {
      throw new Error('Error acuring user');
    }

    const bot = await this.prisma.customerBots.findUnique({
      where: {
        teamId: body.teamId,
        id: body.botId,
        isDeleted: false,
      },
    });

    if (!bot) {
      throw new Error('Bot not found');
    }

    // Run cascade cleanup in background — do not block the response
    this.performBotCascadeCleanup(body.teamId, body.botId).catch((err) =>
      console.error('Bot cascade cleanup error:', err),
    );

    // Soft-delete the bot record
    await this.prisma.customerBots.update({
      where: {
        teamId: body.teamId,
        id: body.botId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    const botQuota = await this.prisma.quota.findFirst({
      where: {
        teamId: body.teamId,
        quotaType: 'BOT',
      },
    });

    if (botQuota) {
      await this.prisma.quota.update({
        where: {
          id: botQuota.id,
        },
        data: {
          used: Math.max(0, botQuota.used - 1),
        },
      });
    }

    await this.systemLogService.createLog({
      category: 'BOT',
      action: 'DELETE',
      status: 'SUCCESS',
      userId,
      userEmail,
      teamId: body.teamId,
      entityId: body.botId,
      entityName: bot.botName,
      message: `Bot deleted: ${bot.botName}`,
    });

    return { message: 'Bot deleted' };
  }

  private async performBotCascadeCleanup(teamId: string, botId: string): Promise<void> {
    const bucket = this.configService.get('S3_BUCKET_NAME');
    const ingestUrl = this.configService.get('INGEST_ENPOINT');

    // 1. Soft-delete all Storage records and remove files from MinIO
    const storageRecords = await this.prisma.storage.findMany({
      where: { teamId, botId, isDeleted: false },
    });

    for (const file of storageRecords) {
      try {
        await this.minioClientService.delete(file.fileUrl, bucket);
      } catch (err) {
        console.error(`MinIO delete failed for ${file.fileUrl}:`, err);
      }
      try {
        await this.prisma.storage.update({
          where: { id: file.id },
          data: { isDeleted: true, deletedAt: new Date() },
        });
      } catch (err) {
        console.error(`Storage soft-delete failed for ${file.id}:`, err);
      }
    }

    // 2. Soft-delete all Content records (Q&A, web pages, text, etc.)
    await this.prisma.content.updateMany({
      where: { teamId, botId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    // 3. Soft-delete all CustomerChats for this bot
    await this.prisma.customerChats.updateMany({
      where: { teamId, botId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    // 4. Delete the entire Elasticsearch index for this bot (most efficient)
    //
    // TODO: This call requires the /delete-bot-index endpoint to be implemented
    // in fovi-longa-chat-be. See: DEVELOPER_NOTE_delete_bot_index.md in that repo.
    // Until then this will fail gracefully (non-fatal, caught below).
    try {
      await firstValueFrom(
        this.httpService.post(`${ingestUrl}/delete-bot-index`, {
          customer_cuid: teamId,
          bot_cuid: botId,
        }).pipe(
          catchError((err: AxiosError) => {
            console.error('delete-bot-index failed:', err.message);
            throw err;
          }),
        ),
      );
    } catch (err) {
      console.error('Vector index deletion failed (non-fatal):', err);
    }
  }
  async updateSettings(body: UpdateSettingsRequest) {
    const { botId, settings } = body;

    const existingBot = await this.prisma.customerBots.findUnique({
      where: { id: botId },
    });

    if (!existingBot) {
      throw new Error('Bot not found');
    }
    const parsedSettings =
      typeof settings === 'string' ? JSON.parse(settings) : settings;

    const updatedBot = await this.prisma.customerBots.update({
      where: { id: botId },
      data: {
        settings: parsedSettings,
      },
    });

    await this.systemLogService.createLog({
      category: 'BOT',
      action: 'UPDATE',
      status: 'SUCCESS',
      entityId: botId,
      message: `Bot settings updated`,
    });

    return {
      message: 'Settings updated successfully',
      bot: updatedBot,
    };
  }

  async listBots(teamId: string) {
    const findUser = await this.prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!findUser) {
      throw new Error('Error acuring user');
    }

    const bots = await this.prisma.customerBots.findMany({
      where: {
        teamId: teamId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    if (bots) {
      return bots;
    }
    throw new Error('Error listing bots');
  }

  async botDetail(botId: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: {
        id: botId,
        isDeleted: false,
      },
    });

    if (bot) {
      return bot;
    }
    throw new Error('Error listing bots');
  }

  async renameBot(body: RenameBotRequest, userId?: string, userEmail?: string) {
    const findUser = await this.prisma.team.findUnique({
      where: {
        id: body.teamId,
      },
    });

    if (!findUser) {
      throw new Error('Error acuring user');
    }

    const bot = await this.prisma.customerBots.update({
      where: {
        teamId: body.teamId,
        id: body.botId,
      },
      data: {
        botName: body.name,
        systemPrompt: body.systemPrompt,
      },
    });

    if (bot) {
      await this.systemLogService.createLog({
        category: 'BOT',
        action: 'UPDATE',
        status: 'SUCCESS',
        userId,
        userEmail,
        teamId: body.teamId,
        entityId: body.botId,
        entityName: body.name,
        message: `Bot renamed/prompt updated: ${body.name}`,
      });
      return { message: 'Bot name changed' };
    }
    throw new Error('Error changing bot name');
  }

  async changeStatus(body: ChageStatusBotRequest) {
    const findUser = await this.prisma.team.findUnique({
      where: {
        id: body.teamId,
      },
    });

    if (!findUser) {
      throw new Error('Error acuring user');
    }

    const bot = await this.prisma.customerBots.update({
      where: {
        teamId: body.teamId,
        id: body.botId,
      },
      data: {
        active: !body.active,
      },
    });

    if (bot) {
      return { message: 'Bot status changed' };
    }
    throw new Error('Error changing bot status');
  }

  async chat(body: ChatRequest, ip: string) {

    console.log("chat body", body);

    const rawMessage = body.message ?? '';
    if (rawMessage.length > 2000) {
      throw new BadRequestException('Message exceeds the 2000-character limit.');
    }
    const wordCount = rawMessage.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 300) {
      throw new BadRequestException('Message exceeds the 300-word limit.');
    }

    try {
      const botUser = await this.prisma.customerBots.findFirst({
        where: {
          id: body.botId
        }
      });

      if (!botUser) {
        throw new Error('Error acuring bot');
      }

      let activeChat = null;
      let isNewChat = false;
      let geoData = null;

      // Sadece chatId varsa mevcut chat'i ara
      if (body.chatId) {
        activeChat = await this.prisma.customerChats.findFirst({
          where: {
            botId: body.botId,
            teamId: body.teamId,
            chatId: body.chatId,
            isDeleted: false
          }
        });
      }

      // ── Auto-closed bot chat: reopen when customer sends a new message ──
      if (activeChat && activeChat.chatStatus === 'CLOSED') {
        await this.prisma.customerChats.update({
          where: { id: activeChat.id },
          data: { chatStatus: 'BOT_ACTIVE', updatedAt: new Date() },
        });
        activeChat = { ...activeChat, chatStatus: 'BOT_ACTIVE' };
      }

      // ── LLM Bypass: sohbet bir insan ajana aktarıldıysa bot cevap vermez ──
      if (activeChat && activeChat.chatStatus === 'HUMAN_ACTIVE') {
        // Kullanıcı mesajını kaydet
        await this.prisma.customerChatDetails.create({
          data: {
            chatId: activeChat.id,
            sender: 'user',
            message: body.message,
            attachments: body.attachments ? (body.attachments as any) : undefined,
            createdAt: new Date(body.date),
          },
        });
        await this.prisma.customerChats.update({
          where: { id: activeChat.id },
          data: { updatedAt: new Date() },
        });
        // Ajanı bilgilendir (WebSocket)
        if (activeChat.agentUserId) {
          this.eventsGateway.notifyAgent(activeChat.agentUserId, {
            chatId: activeChat.id,
            sender: 'user',
            message: body.message,
            createdAt: new Date().toISOString(),
          });
        }
        return { agent_active: true, session_id: body.chatId };
      }
      // ───────────────────────────────────────────────────────────────
      if (!activeChat) {
        isNewChat = true;
        let ipAddress = ip === "::1" ? "176.40.241.220" : ip;

        const geo = await firstValueFrom(
          this.httpService.get(`https://get.geojs.io/v1/ip/geo/${ipAddress}.json`)
            .pipe(
              catchError((error: AxiosError) => {
                console.log("error", error);
                throw 'An error happened!';
              }),
            ));
        console.log("geo", geo.data);
        geoData = geo.data;
      }

      const ingestUrl = this.configService.get('INGEST_ENPOINT');

      // Get team owner to check subscription
      const team = await this.prisma.team.findUnique({
        where: { id: body.teamId },
        include: { owner: true },
      });

      if (!team) {
        throw new Error('Team not found');
      }

      // Check subscription quota
      const quotaCheck = await this.subscriptionService.checkTokenQuota(team.ownerId, {
        teamId: body.teamId,
        entityId: body.botId,
        entityName: botUser.botName,
      });
      if (!quotaCheck.allowed) {
        // Send email notification if user is free tier
        const subscription = await this.prisma.subscription.findUnique({
          where: { userId: team.ownerId },
        });

        if (subscription?.tier === 'FREE') {
          await this.mailService.sendTokenLimitReachedEmail(team.owner.email, team.owner.name, 'en');
        }

        throw new ForbiddenException(quotaCheck.message || 'Token quota exceeded');
      }

      // FastAPI'ye istek at - session_id FastAPI tarafından üretilir
      let data;
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${ingestUrl}/chat`, {
            bot_cuid: botUser.id,
            customer_cuid: botUser.teamId,
            messages: [body.message],
            system_prompt: botUser.systemPrompt,
            // Per-bot Bedrock model tier ('haiku' | 'sonnet'). The
            // plan-tier gate lives in updateModelTier — by the time
            // this value is persisted, the team already has the plan
            // that unlocks it. Older gateway pods that don't know
            // about model_tier silently ignore it (Pydantic Optional).
            model_tier: botUser.modelTier,
            session_id: body.chatId, // null veya mevcut session_id
            // Forward the widget's provisional consent id (widget records
            // KVKK consent BEFORE the first chat POST, so the row exists
            // with chatId=null; gateway binds it to session_id before its
            // own has_fresh_kvkk_consent probe runs, so the check passes
            // and no short-circuit occurs). Older gateway pods that don't
            // know about this field ignore it (Pydantic Optional).
            provisional_consent_id: (body as any).provisionalConsentId,
            // Widget's active i18next locale. Gateway's language_resolver
            // uses this as a tie-breaker when the visitor's own message is
            // too short/ambiguous for lingua to classify (single digits,
            // "??"). Older gateway pods ignore this (Pydantic Optional).
            visitor_locale: body.visitorLocale,
            // Browser Accept-Language HTTP header — third-tier signal
            // for the gateway's v2 hybrid language resolver, used when
            // there's no session sticky AND lingua abstains AND no
            // visitor_locale. Older gateway pods (pre-v2) ignore this.
            accept_language: body.acceptLanguage,
          })
        );
        data = response.data;
      } catch (error) {
        console.log('error', error);
        if (error instanceof AxiosError && error.response?.status === 503) {
          return { message: 'Service busy, retry later' };
        }
        console.log('error', error);
        throw new Error('Error in chat');
      }
      console.log("ingest gelen", data);

      // FastAPI'den dönen session_id'yi kullan
      const sessionId = data.session_id;
      if (!sessionId) {
        throw new Error('Session ID not returned from FastAPI');
      }

      const tokenArr = data.content.split(" ");
      const tokenCount = data.tokens?.total_tokens || tokenArr.length;

      console.log("tokenArr", tokenArr.length);
      console.log("token count", tokenCount);

      // Track token usage in subscription system
      await this.subscriptionService.trackTokenUsage(
        team.ownerId,
        tokenCount,
        body.teamId
      );

      // Yeni chat ise oluştur, mevcut ise güncelle
      // Kanal tespiti: chatId prefix'inden otomatik belirle
      const chatChannel = body.chatId?.startsWith('wa_') ? 'WHATSAPP'
        : body.chatId?.startsWith('fb_') ? 'META_MESSENGER'
          : body.chatId?.startsWith('ig_') ? 'INSTAGRAM'
            : 'WIDGET';
      const externalContactId = (chatChannel !== 'WIDGET') ? body.sender : null;

      if (isNewChat) {
        activeChat = await this.prisma.customerChats.create({
          data: {
            botId: body.botId,
            teamId: body.teamId,
            chatId: sessionId, // FastAPI'den gelen session_id
            isDeleted: false,
            totalTokens: tokenCount,
            channel: chatChannel,
            externalContactId: externalContactId,
            externalContactName: body.externalContactName ?? null,
            // Gateway detects this once from the first user message
            // (LanguageEnforcementMiddleware's heuristic) and returns it
            // on the very first /chat response for a session; locked here
            // at row-creation and never overwritten afterward.
            detectedLanguage: data.detected_language ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            CustomerChatDetails: {
              create: [
                {
                  sender: 'user',
                  message: body.message,
                  attachments: body.attachments ? (body.attachments as any) : undefined,
                  createdAt: new Date(body.date),
                },
                {
                  sender: "bot",
                  message: data.content,
                  tokenDetails: data.tokens,
                  createdAt: new Date(),
                }
              ]
            },
            GeoLocation: {
              create: {
                ip: geoData.ip || '',
                country: geoData.country || '',
                countryCode: geoData.country_code || '',
                region: geoData.region || '',
                city: geoData.city || '',
                latitude: parseFloat(geoData.latitude) || 0,
                longitude: parseFloat(geoData.longitude) || 0,
                timezone: geoData.timezone || '',
                organization: geoData.organization || '',
                organization_name: geoData.organization_name || '',
                accuracy: Number(geoData.accuracy) || 0,
              }
            }
          }
        });
      } else {
        // Mevcut chat'e kullanıcı mesajını ve bot cevabını ekle
        await this.prisma.customerChatDetails.createMany({
          data: [
            {
              chatId: activeChat.id,
              sender: 'user',
              message: body.message,
              attachments: body.attachments ? (body.attachments as any) : undefined,
              createdAt: new Date(body.date),
            },
            {
              chatId: activeChat.id,
              sender: "bot",
              message: data.content,
              tokenDetails: data.tokens,
              createdAt: new Date(),
            }
          ]
        });

        await this.prisma.customerChats.update({
          where: {
            id: activeChat.id
          },
          data: {
            updatedAt: new Date(),
            totalTokens: {
              increment: tokenCount
            },
          }
        });
      }

      console.log("return data", data)

      // ── Auto-handover: if LLM signals human_handover and bot has a defaultAgentId ──
      if (data.human_handover && activeChat) {
        // P2 Faz 4: record the handover request in PerChatFlowState so
        // downstream consumers (admin dashboards, cron, analytics)
        // observe HANDOFF activity without scraping gateway logs. The
        // first transition covers "requested" — whether or not the
        // assignment path below actually succeeds. safeTransition
        // swallows any error so it can't derail the handover flow.
        await this.chatFlowService.safeTransition(
          botUser.id,
          sessionId,
          FlowKind.HANDOFF,
          { from: null, to: 'REQUESTED', payload: { source: 'auto_handover_signal' } },
          'bot:autoHandover:requested',
        );
        const settings = botUser.settings as any;
        const defaultAgentId = settings?.defaultAgentId;
        if (defaultAgentId) {
          try {
            const team = await this.prisma.team.findUnique({
              where: { id: body.teamId },
              select: { ownerId: true },
            });
            const isOwner = team?.ownerId === defaultAgentId;
            const isMember = isOwner ? true : !!(await this.prisma.teamMember.findFirst({
              where: { teamId: body.teamId, userId: defaultAgentId, status: 'active' },
            }));
            if (isMember) {
              await this.prisma.customerChats.update({
                where: { id: activeChat.id },
                data: { chatStatus: 'HUMAN_ACTIVE', agentUserId: defaultAgentId },
              });
              // P2 Faz 4: promote REQUESTED → ASSIGNED once the chat
              // row is flipped to HUMAN_ACTIVE and the agent is being
              // notified. optimistic-lock from='REQUESTED' guards
              // against the unlikely case where a second concurrent
              // handover leaked past.
              await this.chatFlowService.safeTransition(
                botUser.id,
                sessionId,
                FlowKind.HANDOFF,
                {
                  from: 'REQUESTED',
                  to: 'ASSIGNED',
                  payload: {
                    source: 'auto_handover_assigned',
                    agentUserId: defaultAgentId,
                    chatRowId: activeChat.id,
                  },
                },
                'bot:autoHandover:assigned',
              );
              this.eventsGateway.notifyAgent(defaultAgentId, {
                chatId: activeChat.id,
                type: 'auto_handover',
                message: 'New live chat conversation assigned to you.',
              });

              const sessionLink = `${process.env.FRONTEND_URL}/live-chat/${activeChat.id}`;
              this.eventsGateway.notifyHandoffRequested(defaultAgentId, {
                chatId: activeChat.id,
                botName: botUser.botName,
                sessionLink,
              });

              try {
                const agentUser = await this.prisma.user.findUnique({
                  where: { id: defaultAgentId },
                  select: { email: true },
                });
                if (agentUser?.email) {
                  await this.mailService.sendHandoffNotification(
                    agentUser.email,
                    botUser.botName,
                    sessionLink,
                  );
                }
              } catch (mailError) {
                console.log('Handoff notification email failed:', mailError);
              }

              try {
                await this.pushNotificationService.sendToUser(defaultAgentId, {
                  title: 'Yeni canlı sohbet',
                  body: `${botUser.botName} bir görüşmeyi size aktardı.`,
                  data: { type: 'handoff_requested', chatId: activeChat.id },
                });
              } catch (pushError) {
                console.log('Handoff push notification failed:', pushError);
              }
            }
          } catch (e) {
            console.log('Auto-handover failed:', e);
          }
        }
      }

      return {
        ...data,
        session_id: sessionId
      };
    }
    catch (error) {
      // Any failure inside the chat pipeline used to bubble up as a
      // generic 500 to the widget, which renders "Internal Server
      // Error" to the site visitor. That kills trust in the bot AND
      // in Chatbu itself, and hides the actual failure from the bot
      // owner (they don't get any signal that their bot is broken).
      //
      // Fix (2026-07-22 prod incident): swallow the throw, return a
      // graceful bot-reply-shaped response. Widget renders it as a
      // normal message. Original error is logged at ERROR level with
      // structured context so ops / on-call still see it and can
      // reach out to the bot owner.
      //
      // Explicit account-blocked path gets its own log tag so a
      // billing-side alert can pattern-match on it without parsing
      // the whole stack.
      const isBlocked =
        error?.status === 403 &&
        typeof error?.message === 'string' &&
        error.message.toLowerCase().includes('blocked due to payment');
      const logCtx = {
        botId: body?.botId,
        teamId: body?.teamId,
        chatId: body?.chatId,
        isBlocked,
        errorClass: error?.constructor?.name,
        errorMessage: error?.message,
      };
      if (isBlocked) {
        console.error('[chat.blocked_by_billing]', logCtx);
      } else {
        console.error('[chat.error]', logCtx, error);
      }

      // Best-effort enrichment: if the bot owner configured contact
      // info in `settings.contactEmail` / `settings.contactPhone`,
      // surface it so the visitor can actually reach the business
      // instead of a dead end. A settings-lookup failure just falls
      // through to the generic message — the whole point of this
      // catch is to never re-throw to the widget.
      let contactEmail: string | undefined;
      let contactPhone: string | undefined;
      try {
        if (body?.botId) {
          const bot = await this.prisma.customerBots.findUnique({
            where: { id: body.botId },
            select: { settings: true },
          });
          const settings = (bot?.settings as any) || {};
          contactEmail =
            typeof settings.contactEmail === 'string' && settings.contactEmail.trim()
              ? settings.contactEmail.trim()
              : undefined;
          contactPhone =
            typeof settings.contactPhone === 'string' && settings.contactPhone.trim()
              ? settings.contactPhone.trim()
              : undefined;
        }
      } catch (settingsErr: any) {
        console.warn(
          '[chat.fallback.settings_lookup_failed]',
          settingsErr?.message ?? settingsErr,
        );
      }

      // Compose the visitor-facing message. Deliberately generic on
      // the "why" (quota / billing / ML down) — not the visitor's
      // problem and often reveals internal state. Contact info, if
      // available, is what actually helps them get unstuck.
      const channels: string[] = [];
      if (contactEmail) channels.push(contactEmail);
      if (contactPhone) channels.push(contactPhone);
      const fallbackMessage =
        channels.length > 0
          ? `Şu anda size yanıt veremiyorum. Lütfen işletmeyle doğrudan iletişime geçin: ${channels.join(' veya ')}.`
          : 'Şu anda size yanıt veremiyorum. Lütfen daha sonra tekrar deneyin veya bu sitenin sahibiyle doğrudan iletişime geçin.';

      return {
        content: fallbackMessage,
        session_id: body?.chatId || `fallback-${Date.now()}`,
        tokens: { total_tokens: 0 },
      };
    }


  }

  // ─── Streaming (SSE) chat path — voice agent plan Faz 2b PR 2 ────
  //
  // Widget SSE proxy for `/chat`. Structurally parallel to `chat()`
  // above; the pre-check chain (message validation → bot lookup →
  // activeChat lookup → HUMAN_ACTIVE bypass → quota → geo) is
  // duplicated intentionally rather than extracted, so the existing
  // batch `chat()` stays untouched and Meta/WhatsApp adapters that
  // call it never notice this PR exists. A follow-up refactor can
  // extract `_persistTranscript()` + `_maybeAutoHandover()` helpers
  // once both paths are in prod and the drift risk is measured.
  //
  // HUMAN_ACTIVE bypass returns a batch JSON (user decision 2026-08-04
  // karar C): visitor's message is stored, live agent is notified via
  // websocket, and the widget receives `{ agent_active: true }` — the
  // exact shape the frontend already handles. No SSE headers are sent
  // in this branch, so the response Content-Type stays application/json.
  //
  // The gateway (fovi-longa-chat-be PR #396) emits five SSE event
  // types: token/tool_call/tool_result/metadata/end (+ error). The
  // widget cares about token + metadata + end; everything else is
  // forwarded verbatim and can be observed by voice pods in later
  // phases without a protocol change here.
  //
  // Every write to `res` before `res.end()` is a *pass-through* of a
  // gateway byte; the shadow parser (`SseFrameParser`) reads a copy
  // for post-stream persistence + auto-handover. Client never sees
  // any frame the accumulator invented.
  async chatStream(
    body: ChatRequest,
    ip: string,
    res: Response,
  ): Promise<{
    tokenCount: number;
    humanHandover: boolean;
    sessionId: string | null;
  }> {
    const rawMessage = body.message ?? '';
    if (rawMessage.length > 2000) {
      throw new BadRequestException('Message exceeds the 2000-character limit.');
    }
    const wordCount = rawMessage.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 300) {
      throw new BadRequestException('Message exceeds the 300-word limit.');
    }

    const botUser = await this.prisma.customerBots.findFirst({
      where: { id: body.botId },
    });
    if (!botUser) {
      throw new Error('Error acuring bot');
    }

    let activeChat = null;
    let isNewChat = false;
    let geoData: any = null;

    if (body.chatId) {
      activeChat = await this.prisma.customerChats.findFirst({
        where: {
          botId: body.botId,
          teamId: body.teamId,
          chatId: body.chatId,
          isDeleted: false,
        },
      });
    }

    // Auto-reopen a CLOSED chat when the visitor returns (mirrors
    // batch path). Safe to run before we've committed to SSE headers.
    if (activeChat && activeChat.chatStatus === 'CLOSED') {
      await this.prisma.customerChats.update({
        where: { id: activeChat.id },
        data: { chatStatus: 'BOT_ACTIVE', updatedAt: new Date() },
      });
      activeChat = { ...activeChat, chatStatus: 'BOT_ACTIVE' };
    }

    // HUMAN_ACTIVE bypass: no SSE, batch JSON response. The frontend
    // widget's existing `agent_active: true` handler catches this —
    // no protocol changes needed on the client for the takeover case.
    if (activeChat && activeChat.chatStatus === 'HUMAN_ACTIVE') {
      await this.prisma.customerChatDetails.create({
        data: {
          chatId: activeChat.id,
          sender: 'user',
          message: body.message,
          attachments: body.attachments ? (body.attachments as any) : undefined,
          createdAt: new Date(body.date),
        },
      });
      await this.prisma.customerChats.update({
        where: { id: activeChat.id },
        data: { updatedAt: new Date() },
      });
      if (activeChat.agentUserId) {
        this.eventsGateway.notifyAgent(activeChat.agentUserId, {
          chatId: activeChat.id,
          sender: 'user',
          message: body.message,
          createdAt: new Date().toISOString(),
        });
      }
      res.status(200).json({ agent_active: true, session_id: body.chatId });
      // HUMAN_ACTIVE bypass: no tokens consumed against subscription
      // and no auto-handover check needed — the chat is already with
      // a human. Widget quota counters increment by messageCount only.
      return { tokenCount: 0, humanHandover: false, sessionId: body.chatId ?? null };
    }

    if (!activeChat) {
      isNewChat = true;
      const ipAddress = ip === '::1' ? '176.40.241.220' : ip;
      try {
        const geo = await firstValueFrom(
          this.httpService.get(
            `https://get.geojs.io/v1/ip/geo/${ipAddress}.json`,
          ),
        );
        geoData = geo.data;
      } catch (e) {
        console.warn('[chatStream] geo lookup failed:', (e as any)?.message ?? e);
        geoData = {};
      }
    }

    const ingestUrl = this.configService.get('INGEST_ENPOINT');

    const team = await this.prisma.team.findUnique({
      where: { id: body.teamId },
      include: { owner: true },
    });
    if (!team) {
      throw new Error('Team not found');
    }

    // Same subscription quota gate as batch. Throws BEFORE we commit
    // to SSE headers so the widget receives a normal 403 (which its
    // existing quota-exceeded banner handles).
    const quotaCheck = await this.subscriptionService.checkTokenQuota(
      team.ownerId,
      {
        teamId: body.teamId,
        entityId: body.botId,
        entityName: botUser.botName,
      },
    );
    if (!quotaCheck.allowed) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId: team.ownerId },
      });
      if (subscription?.tier === 'FREE') {
        await this.mailService.sendTokenLimitReachedEmail(
          team.owner.email,
          team.owner.name,
          'en',
        );
      }
      throw new ForbiddenException(
        quotaCheck.message || 'Token quota exceeded',
      );
    }

    // ─── SSE headers committed from here on ───
    // Everything above could still throw a 403/400/500 with a JSON
    // body. Once we call flushHeaders(), the response is locked into
    // text/event-stream and any error must surface as an `event: error`
    // SSE frame (or connection close), NOT an HTTP error status.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Tell any intermediate proxy (NGINX/ALB) NOT to buffer — SSE
    // depends on immediate flush of each frame. Matches the gateway's
    // own header set (app-gateway/routers/chat_endpoint.py).
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Open upstream stream to the gateway. `responseType: 'stream'`
    // gives us a Node Readable instead of accumulating into memory.
    let gatewayResponse: any;
    try {
      gatewayResponse = await firstValueFrom(
        this.httpService.post(
          `${ingestUrl}/chat`,
          {
            bot_cuid: botUser.id,
            customer_cuid: botUser.teamId,
            messages: [body.message],
            system_prompt: botUser.systemPrompt,
            model_tier: botUser.modelTier,
            session_id: body.chatId,
            provisional_consent_id: (body as any).provisionalConsentId,
            // See non-stream /chat path above for rationale.
            visitor_locale: body.visitorLocale,
            accept_language: body.acceptLanguage,
          },
          {
            responseType: 'stream',
            headers: { Accept: 'text/event-stream' },
          },
        ),
      );
    } catch (error) {
      // Upstream failed to even open — emit one error frame the
      // frontend can render as a friendly message + close the stream.
      const msg =
        error instanceof AxiosError && error.response?.status === 503
          ? 'Service busy, retry later'
          : 'Upstream chat service unavailable';
      console.error('[chatStream] gateway open failed:', msg, error);
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`,
      );
      res.write('event: end\ndata: {}\n\n');
      res.end();
      return { tokenCount: 0, humanHandover: false, sessionId: body.chatId ?? null };
    }

    // The gateway sometimes fails INSIDE the stream (e.g. Bedrock
    // rate-limit mid-generation). axios stream error handler is
    // registered below; on failure we emit an error frame and close.
    const gatewayStream = gatewayResponse.data as Readable;
    const parser = new SseFrameParser();
    let contentBuf = '';
    let metadata: any = {};

    gatewayStream.on('data', (chunk: Buffer) => {
      // 1. Forward the raw bytes VERBATIM to the widget client so it
      //    sees the exact gateway protocol — this preserves the
      //    contract for voice pods that come later.
      res.write(chunk);
      // 2. Shadow-parse for post-stream persistence. Malformed frames
      //    are silently dropped by the parser (see its doc); we only
      //    use the parsed data to observe, never to rewrite forwarded
      //    bytes.
      for (const frame of parser.feed(chunk)) {
        if (frame.event === 'token' && typeof frame.data === 'object') {
          contentBuf += frame.data.delta || '';
        } else if (frame.event === 'metadata' && typeof frame.data === 'object') {
          metadata = frame.data;
        }
      }
    });

    // Wait for the gateway stream to finish (end or error). We do NOT
    // return until this settles — even though the widget already has
    // its bytes, we still owe the DB a transcript + handover check.
    try {
      await new Promise<void>((resolve, reject) => {
        gatewayStream.on('end', () => resolve());
        gatewayStream.on('error', reject);
      });
    } catch (streamErr) {
      console.error('[chatStream] gateway stream errored:', streamErr);
      // Best-effort: tell the client we lost the stream. The `end`
      // frame is what closes the reader loop on the frontend.
      try {
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: 'stream interrupted' })}\n\n`,
        );
        res.write('event: end\ndata: {}\n\n');
      } catch {
        /* connection already dead */
      }
      res.end();
      return { tokenCount: 0, humanHandover: false, sessionId: body.chatId ?? null };
    }

    // Drain any trailing partial frame (rare — gateway is well-
    // behaved — but if the connection closed on an odd byte boundary
    // the last metadata event could still be recoverable).
    for (const frame of parser.flush()) {
      if (frame.event === 'metadata' && typeof frame.data === 'object') {
        metadata = frame.data;
      }
    }

    // The widget's part is done. End the response IMMEDIATELY so the
    // frontend's reader loop settles and the "typing..." spinner
    // clears; every post-stream side effect (transcript persistence,
    // auto-handover, token accounting) happens AFTER — the widget
    // does not wait on the DB write.
    res.end();

    // ─── Post-stream side effects (best-effort, not awaited by client) ───
    // Any exception here is logged but never re-thrown — the widget
    // already got its response, and re-throwing would only pollute
    // the request log.
    try {
      const sessionId = metadata.session_id || body.chatId;
      if (!sessionId) {
        console.error(
          '[chatStream] no session_id in metadata event — skipping persistence',
        );
        // Contract fix (2026-08-05 prod incident): this used to be a
        // bare `return;` which resolved the outer Promise to
        // `undefined`, crashing WidgetService.chatStream on
        // `streamResult.tokenCount`. Return the zero-shape so the
        // caller sees a valid metadata object even when persistence
        // is skipped. Trigger case observed: gateway returned batch
        // JSON on an SSE request (KVKK short-circuit / throttled /
        // Bedrock Guardrails paths on `chat_endpoint.py`), so the SSE
        // parser never captured a metadata event and session_id fell
        // through null. The gateway-side fix (SSE-formatted early
        // returns) is on a separate PR; this one just stops the crash.
        return { tokenCount: 0, humanHandover: false, sessionId: null };
      }
      const tokenCount =
        metadata.tokens?.total_tokens ||
        contentBuf.split(/\s+/).filter(Boolean).length;

      // Track subscription tokens (mirror of batch L642-646).
      if (tokenCount > 0) {
        await this.subscriptionService.trackTokenUsage(
          team.ownerId,
          tokenCount,
          body.teamId,
        );
      }

      // Persist transcript. Structurally identical to batch L657-734,
      // but sourced from the shadow accumulator instead of a batch
      // JSON response. Widget-only path — channel is always WIDGET
      // (Meta/WhatsApp adapters call the batch `chat()` and never
      // reach this method).
      if (isNewChat) {
        activeChat = await this.prisma.customerChats.create({
          data: {
            botId: body.botId,
            teamId: body.teamId,
            chatId: sessionId,
            isDeleted: false,
            totalTokens: tokenCount,
            channel: 'WIDGET',
            externalContactId: null,
            externalContactName: null,
            // Same first-turn detection as the batch path (L677), sourced
            // from the SSE metadata event instead of a batch JSON body.
            detectedLanguage: metadata.detected_language ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            CustomerChatDetails: {
              create: [
                {
                  sender: 'user',
                  message: body.message,
                  attachments: body.attachments
                    ? (body.attachments as any)
                    : undefined,
                  createdAt: new Date(body.date),
                },
                {
                  sender: 'bot',
                  message: contentBuf,
                  tokenDetails: metadata.tokens || null,
                  createdAt: new Date(),
                },
              ],
            },
            GeoLocation: {
              create: {
                ip: geoData?.ip || '',
                country: geoData?.country || '',
                countryCode: geoData?.country_code || '',
                region: geoData?.region || '',
                city: geoData?.city || '',
                latitude: parseFloat(geoData?.latitude) || 0,
                longitude: parseFloat(geoData?.longitude) || 0,
                timezone: geoData?.timezone || '',
                organization: geoData?.organization || '',
                organization_name: geoData?.organization_name || '',
                accuracy: Number(geoData?.accuracy) || 0,
              },
            },
          },
        });
      } else {
        await this.prisma.customerChatDetails.createMany({
          data: [
            {
              chatId: activeChat.id,
              sender: 'user',
              message: body.message,
              attachments: body.attachments
                ? (body.attachments as any)
                : undefined,
              createdAt: new Date(body.date),
            },
            {
              chatId: activeChat.id,
              sender: 'bot',
              message: contentBuf,
              tokenDetails: metadata.tokens || null,
              createdAt: new Date(),
            },
          ],
        });
        await this.prisma.customerChats.update({
          where: { id: activeChat.id },
          data: {
            updatedAt: new Date(),
            totalTokens: { increment: tokenCount },
          },
        });
      }

      // Auto-handover — mirror of batch L737-822. Same P2 Faz 4 flow-
      // state transitions, same events gateway notifications, same
      // agent email. Duplicated inline for now; extract to
      // `_maybeAutoHandover(...)` in the follow-up refactor.
      if (metadata.human_handover && activeChat) {
        await this.chatFlowService.safeTransition(
          botUser.id,
          sessionId,
          FlowKind.HANDOFF,
          {
            from: null,
            to: 'REQUESTED',
            payload: { source: 'auto_handover_signal_stream' },
          },
          'bot:autoHandover:requested:stream',
        );
        const settings = botUser.settings as any;
        const defaultAgentId = settings?.defaultAgentId;
        if (defaultAgentId) {
          try {
            const teamRow = await this.prisma.team.findUnique({
              where: { id: body.teamId },
              select: { ownerId: true },
            });
            const isOwner = teamRow?.ownerId === defaultAgentId;
            const isMember = isOwner
              ? true
              : !!(await this.prisma.teamMember.findFirst({
                  where: {
                    teamId: body.teamId,
                    userId: defaultAgentId,
                    status: 'active',
                  },
                }));
            if (isMember) {
              await this.prisma.customerChats.update({
                where: { id: activeChat.id },
                data: {
                  chatStatus: 'HUMAN_ACTIVE',
                  agentUserId: defaultAgentId,
                },
              });
              await this.chatFlowService.safeTransition(
                botUser.id,
                sessionId,
                FlowKind.HANDOFF,
                {
                  from: 'REQUESTED',
                  to: 'ASSIGNED',
                  payload: {
                    source: 'auto_handover_assigned_stream',
                    agentUserId: defaultAgentId,
                    chatRowId: activeChat.id,
                  },
                },
                'bot:autoHandover:assigned:stream',
              );
              this.eventsGateway.notifyAgent(defaultAgentId, {
                chatId: activeChat.id,
                type: 'auto_handover',
                message: 'New live chat conversation assigned to you.',
              });
              const sessionLink = `${process.env.FRONTEND_URL}/live-chat/${activeChat.id}`;
              this.eventsGateway.notifyHandoffRequested(defaultAgentId, {
                chatId: activeChat.id,
                botName: botUser.botName,
                sessionLink,
              });
              try {
                const agentUser = await this.prisma.user.findUnique({
                  where: { id: defaultAgentId },
                  select: { email: true },
                });
                if (agentUser?.email) {
                  await this.mailService.sendHandoffNotification(
                    agentUser.email,
                    botUser.botName,
                    sessionLink,
                  );
                }
              } catch (mailError) {
                console.log(
                  '[chatStream] handoff notification email failed:',
                  mailError,
                );
              }
            }
          } catch (e) {
            console.log('[chatStream] auto-handover failed:', e);
          }
        }
      }
    } catch (persistErr) {
      // Persistence failures do NOT propagate — widget already got its
      // response. Log with structured context so ops can spot patterns
      // (chat missing from history, but visitor did have a conversation).
      console.error('[chatStream.persistence]', {
        botId: body?.botId,
        teamId: body?.teamId,
        chatId: body?.chatId,
        errorClass: (persistErr as any)?.constructor?.name,
        errorMessage: (persistErr as any)?.message,
      });
    }

    // Return the accumulated metadata so widget.service.ts can update
    // its own visitor counter (messageCountToday, tokenUsageToday,
    // riskScore) — those live on WidgetVisitor which the bot module
    // must not touch. Values reflect what the client actually saw:
    // metadata.tokens counted at the gateway, fallback to whitespace
    // split if the gateway didn't emit a token count.
    const finalTokenCount =
      metadata.tokens?.total_tokens ||
      contentBuf.split(/\s+/).filter(Boolean).length;
    return {
      tokenCount: finalTokenCount,
      humanHandover: !!metadata.human_handover,
      sessionId: metadata.session_id || body.chatId || null,
    };
  }

  /**
   * Wrapper that matches the arg shape of `publicChatInternal` so
   * `WidgetService.chatStream` can call this the same way its batch
   * sibling calls `publicChatInternal`.
   */
  async publicChatStreamInternal(
    botId: string,
    teamId: string,
    message: string,
    chatId: string | undefined,
    ip: string,
    res: Response,
    attachments?: any[],
    provisionalConsentId?: string,
    visitorLocale?: string,
    acceptLanguage?: string,
  ): Promise<{
    tokenCount: number;
    humanHandover: boolean;
    sessionId: string | null;
  }> {
    return this.chatStream(
      {
        botId,
        teamId,
        message,
        chatId: chatId ?? null,
        sender: 'user',
        date: new Date().toISOString(),
        attachments,
        provisionalConsentId,
        visitorLocale,
        acceptLanguage,
      } as any,
      ip,
      res,
    );
  }

  async getBotAppearance(botId: string, teamId: string) {

    const bot = await this.prisma.customerBots.findFirst({
      where: {
        id: botId,
        teamId: teamId,
        isDeleted: false
      },
      select: {
        id: true,
        settings: true,
      }
    });

    if (!bot) {
      return { id: null, settings: null, missing: true };
    }

    return bot;


  }

  async saveBotAppearance(userId: string, botId: string, settings: object) {

    const bot = await this.prisma.customerBots.update({
      where: {
        id: botId,
      },
      data: {
        settings: settings,
      }
    });

    if (!bot) {
      throw new Error('Error acuring bot');
    }

    return bot;

  }

  async getPublicBotSettings(token: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired embed token');
    }
    if (payload.type !== 'embed') {
      throw new UnauthorizedException('Invalid token type');
    }
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: payload.botId, isDeleted: false },
      // `smsVerificationRequired` is surfaced to the widget so the
      // client-side KVKK pre-send gate (chatbu-frontend
      // ChatFormPublic.tsx, P0 Item 3c of the 2026-07-29 security plan)
      // can decide whether to block a phone-carrying message before it
      // ever leaves the browser. The flag itself is not a secret — it's
      // owner-facing config visible in the dashboard — and knowing it
      // client-side only lets the widget improve UX; the actual KVKK
      // guarantee is enforced server-side by the gateway pre-agent
      // scrub (Item 3b) + backend consent gate on requestSmsVerification.
      // `streamingEnabled` (voice agent plan Faz 2b, 2026-08-04) tells
      // the widget frontend whether to send `Accept: text/event-stream`
      // and consume the SSE token stream. Default false — operator
      // flips per pilot bot after dev soak. Every other consumer
      // (Meta/WhatsApp adapters, embed test panel) ignores this and
      // stays on the batch path.
      select: {
        id: true,
        settings: true,
        botName: true,
        smsVerificationRequired: true,
        streamingEnabled: true,
      },
    });
    if (!bot) throw new NotFoundException('Bot not found');
    return bot;
  }

  async publicChat(
    token: string,
    message: string,
    chatId: string | undefined,
    ip: string,
  ) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired embed token');
    }
    if (payload.type !== 'embed') {
      throw new UnauthorizedException('Invalid token type');
    }
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: payload.botId, isDeleted: false },
      select: { id: true, teamId: true },
    });
    if (!bot) throw new NotFoundException('Bot not found');
    return this.chat(
      {
        botId: bot.id,
        teamId: bot.teamId,
        message,
        chatId: chatId ?? null,
        sender: 'user',
        date: new Date().toISOString(),
      } as any,
      ip,
    );
  }

  /**
   * Internal entry point for the WidgetService — bypasses JWT verification
   * because the caller (WidgetService) has already authenticated the session token
   * and resolved the botId/teamId from the verified payload.
   */
  async publicChatInternal(
    botId: string,
    teamId: string,
    message: string,
    chatId: string | undefined,
    ip: string,
    attachments?: any[],
    provisionalConsentId?: string,
    visitorLocale?: string,
    acceptLanguage?: string,
  ) {
    return this.chat(
      {
        botId,
        teamId,
        message,
        chatId: chatId ?? null,
        sender: 'user',
        date: new Date().toISOString(),
        attachments,
        provisionalConsentId,
        visitorLocale,
        acceptLanguage,
      } as any,
      ip,
    );
  }

  async checkIntegration(botId: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: {
        id: botId,
        isDeleted: false
      },
      select: {
        id: true,
      }
    });
    if (!bot) {
      throw new Error('Error acuring bot');
    }

    const token = await this.jwtService.signAsync(
      { botId: bot.id, type: "embed" },
      {
        expiresIn: '2d', // Token expiration time
        secret: this.configService.get('JWT_SECRET'), // Use your JWT secret from config
      },
    );

    return {
      control: true,
      token: token,
    }
  }

  // async generateEmbedToken(
  //   botId: string,
  //   userId: string,
  // ) {
  //   const bot = await this.prisma.customerBots.findUnique({
  //     where: {
  //       id: botId,
  //       userId: userId,
  //       isDeleted: false
  //     },
  //     select: {
  //       id: true,
  //     }
  //   });

  //   if (!bot) {
  //     throw new Error('Error acuring bot');
  //   }

  //   // Generate a token for the bot
  //   const token = this.prisma.customerEmbedTokens.create({
  //     data: {
  //       botId: bot.id,
  //       userId: userId,
  //       integrationType: integrationType,
  //       token: this.generateRandomToken(),
  //     }
  //   });

  //   return token;
  // }

  async updateModelTier(body: UpdateModelTierRequest, teamId: string, userId?: string, userEmail?: string) {
    if (!MODEL_TIERS.includes(body.modelTier as any)) {
      throw new BadRequestException('Invalid model tier');
    }

    const bot = await this.prisma.customerBots.findUnique({
      where: { id: body.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.teamId !== teamId) {
      throw new ForbiddenException('Bot not owned by your team');
    }

    // Plan-tier gate: 'sonnet' requires PREMIUM subscription
    if (body.modelTier !== DEFAULT_MODEL_TIER) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { ownerId: true },
      });

      const subscription = await this.prisma.subscription.findFirst({
        where: { userId: team.ownerId },
        select: { tier: true },
      });

      if (!subscription || subscription.tier !== 'PREMIUM') {
        await this.systemLogService.createLog({
          category: 'BOT',
          action: 'UPDATE_MODEL_TIER',
          status: 'REJECTED_PLAN',
          userId,
          userEmail,
          teamId,
          entityId: bot.id,
          entityName: bot.botName,
          message: `Bot model tier change rejected (plan): ${bot.modelTier} -> ${body.modelTier}`,
        });

        throw new HttpException(
          { message: 'This model is only available on Premium plans', code: 'PLAN_UPGRADE_REQUIRED' },
          402,
        );
      }
    }

    const oldTier = bot.modelTier;

    const updated = await this.prisma.customerBots.update({
      where: { id: body.botId },
      data: { modelTier: body.modelTier },
    });

    await this.systemLogService.createLog({
      category: 'BOT',
      action: 'UPDATE_MODEL_TIER',
      status: 'SUCCESS',
      userId,
      userEmail,
      teamId,
      entityId: bot.id,
      entityName: bot.botName,
      message: `Bot model tier: ${oldTier} -> ${body.modelTier}`,
    });

    return { message: 'Model tier updated', bot: updated };
  }

  async updateLeadDestinations(body: UpdateLeadDestinationsRequest, teamId: string, userId?: string, userEmail?: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: body.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.teamId !== teamId) {
      throw new ForbiddenException('Bot not owned by your team');
    }

    const updated = await this.prisma.customerBots.update({
      where: { id: body.botId },
      data: { leadDestinations: body.destinations as any },
    });

    const enabledCount = body.destinations.filter((d) => d.enabled).length;

    await this.systemLogService.createLog({
      category: 'BOT',
      action: 'UPDATE_LEAD_DESTINATIONS',
      status: 'SUCCESS',
      userId,
      userEmail,
      teamId,
      entityId: bot.id,
      entityName: bot.botName,
      message: `${body.destinations.length} destinations, ${enabledCount} enabled`,
    });

    return { message: 'Lead destinations updated', bot: updated };
  }

  async updateLeadVerification(body: UpdateLeadVerificationRequest, teamId: string, userId?: string, userEmail?: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: body.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.teamId !== teamId) {
      throw new ForbiddenException('Bot not owned by your team');
    }

    const oldValue = bot.leadVerificationRequired;

    const updated = await this.prisma.customerBots.update({
      where: { id: body.botId },
      data: { leadVerificationRequired: body.leadVerificationRequired },
    });

    await this.systemLogService.createLog({
      category: 'BOT',
      action: 'UPDATE_LEAD_VERIFICATION',
      status: 'SUCCESS',
      userId,
      userEmail,
      teamId,
      entityId: bot.id,
      entityName: bot.botName,
      message: `Bot lead-verification: ${oldValue} -> ${body.leadVerificationRequired}`,
    });

    return { message: 'Lead verification setting updated', bot: updated };
  }

  async updateSmsVerification(body: UpdateSmsVerificationRequest, teamId: string, userId?: string, userEmail?: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: body.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.teamId !== teamId) {
      throw new ForbiddenException('Bot not owned by your team');
    }

    const oldValue = bot.smsVerificationRequired;

    const updated = await this.prisma.customerBots.update({
      where: { id: body.botId },
      data: { smsVerificationRequired: body.smsVerificationRequired },
    });

    await this.systemLogService.createLog({
      category: 'BOT',
      action: 'UPDATE_SMS_VERIFICATION',
      status: 'SUCCESS',
      userId,
      userEmail,
      teamId,
      entityId: bot.id,
      entityName: bot.botName,
      message: `Bot sms-verification: ${oldValue} -> ${body.smsVerificationRequired}`,
    });

    return { message: 'SMS verification setting updated', bot: updated };
  }

  /**
   * Per-bot toggle for the widget SSE streaming path (voice plan
   * Faz 2b, 2026-08-04). Structurally identical to
   * updateSmsVerification — same team-ownership check, same audit log
   * shape. Frontend renders a toggle in bot settings that hits this
   * endpoint; there is no derived state and no side effects beyond
   * the Prisma write, so a bad flip is a one-request rollback.
   */
  async updateStreamingEnabled(
    body: UpdateStreamingEnabledRequest,
    teamId: string,
    userId?: string,
    userEmail?: string,
  ) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: body.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.teamId !== teamId) {
      throw new ForbiddenException('Bot not owned by your team');
    }

    const oldValue = bot.streamingEnabled;

    const updated = await this.prisma.customerBots.update({
      where: { id: body.botId },
      data: { streamingEnabled: body.streamingEnabled },
    });

    await this.systemLogService.createLog({
      category: 'BOT',
      action: 'UPDATE_STREAMING_ENABLED',
      status: 'SUCCESS',
      userId,
      userEmail,
      teamId,
      entityId: bot.id,
      entityName: bot.botName,
      message: `Bot streaming-enabled: ${oldValue} -> ${body.streamingEnabled}`,
    });

    return { message: 'Streaming setting updated', bot: updated };
  }

  async getLeadVerificationStatus(botId: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: botId, isDeleted: false },
      select: { leadVerificationRequired: true, smsVerificationRequired: true },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    return {
      requiresVerification: bot.leadVerificationRequired,
      requiresSmsVerification: bot.smsVerificationRequired,
    };
  }

  /**
   * Phase D-2 of the retrieval quality overhaul: per-bot query-time
   * URL glob preferences. Read from `CustomerBots.settings` (existing
   * Json column, no schema migration).
   *
   * Shape:
   *   {
   *     queryUrlAllowGlobs?: string[]      // fnmatch patterns; chunk must match ≥1
   *     queryUrlDenyGlobs?: string[]       // fnmatch patterns; chunk must match NONE
   *     queryUrlBoostGlobs?: {glob: string, boost: number}[]  // soft preference
   *   }
   *
   * Consumed by the FastAPI gateway's `RetrievalMiddleware` via an
   * internal-key-guarded probe on every chat request (60s in-memory
   * cache on the gateway side). Returns empty arrays when the bot has
   * no config — the gateway treats "no config" the same as "no globs".
   */
  async getRetrievalSettings(botId: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: botId, isDeleted: false },
      select: { settings: true },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    const settings = (bot.settings as Record<string, unknown>) || {};
    const asStringArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
    const asBoostArray = (v: unknown): Array<{ glob: string; boost: number }> => {
      if (!Array.isArray(v)) return [];
      return v.flatMap((item) => {
        if (
          typeof item !== 'object' ||
          item === null ||
          typeof (item as { glob?: unknown }).glob !== 'string'
        ) {
          return [];
        }
        const rawBoost = (item as { boost?: unknown }).boost;
        const boost = typeof rawBoost === 'number' && Number.isFinite(rawBoost) ? rawBoost : 1.15;
        const glob = ((item as { glob: string }).glob || '').trim();
        return glob ? [{ glob, boost }] : [];
      });
    };

    return {
      queryUrlAllowGlobs: asStringArray(settings.queryUrlAllowGlobs),
      queryUrlDenyGlobs: asStringArray(settings.queryUrlDenyGlobs),
      queryUrlBoostGlobs: asBoostArray(settings.queryUrlBoostGlobs),
    };
  }

  /**
   * Locked conversation language for a chat, read-only. `chatId` is the
   * gateway's session_id, not CustomerChats.id — the row may not exist
   * yet on a chat's first turn (Nest creates it only after the gateway's
   * response comes back), so "not found" is a normal, expected outcome
   * here, not an error.
   */
  async getChatLanguage(botId: string, chatId: string) {
    const chat = await this.prisma.customerChats.findFirst({
      where: { botId, chatId },
      select: { detectedLanguage: true },
    });
    return { language: chat?.detectedLanguage ?? null };
  }
}
