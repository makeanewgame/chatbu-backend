import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBotRequest } from './dto/createBotRequest';
import { DeleteBotRequest } from './dto/deleteBotRequest';
import { UpdateSettingsRequest } from './dto/updateSettingsRequest';
import { ChageStatusBotRequest } from './dto/changeStatusBotRequest';
import { RenameBotRequest } from './dto/renameBotRequest';
import { ChatRequest } from './dto/chatRequest';
import { catchError, firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionService } from '../subscription/subscription.service';
import { MailService } from '../mail/mail.service';
import { MinioClientService } from 'src/minio-client/minio-client.service';

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
  ) { }

  async createBot(body: CreateBotRequest) {
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

          return { message: 'Bot created' };
        }
        throw new Error('Error creating bot');
      }
    }
    throw new ForbiddenException('Error creating bot');
  }

  async deleteBot(body: DeleteBotRequest) {
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

  async renameBot(body: RenameBotRequest) {
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

      // Yeni chat ise geolocation bilgisini al
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
      const quotaCheck = await this.subscriptionService.checkTokenQuota(team.ownerId);
      if (!quotaCheck.allowed) {
        // Send email notification if user is free tier
        const subscription = await this.prisma.subscription.findUnique({
          where: { userId: team.ownerId },
        });

        if (subscription?.tier === 'FREE') {
          await this.mailService.sendTokenLimitReachedEmail(team.owner.email, team.owner.name);
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
            session_id: body.chatId, // null veya mevcut session_id
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
      if (isNewChat) {
        activeChat = await this.prisma.customerChats.create({
          data: {
            botId: body.botId,
            teamId: body.teamId,
            chatId: sessionId, // FastAPI'den gelen session_id
            isDeleted: false,
            totalTokens: tokenCount,
            createdAt: new Date(),
            updatedAt: new Date(),
            CustomerChatDetails: {
              create: [
                {
                  sender: body.sender,
                  message: body.message,
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
              sender: body.sender,
              message: body.message,
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

      return {
        ...data,
        session_id: sessionId
      };
    }
    catch (error) {
      console.log("error", error);
      throw new Error('Error in chat');
    }


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
      select: { id: true, settings: true, botName: true },
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
}
