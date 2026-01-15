import { ForbiddenException, Injectable } from '@nestjs/common';
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

@Injectable()
export class BotService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private subscriptionService: SubscriptionService,
    private mailService: MailService,
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

    const bot = await this.prisma.customerBots.update({
      where: {
        teamId: body.teamId,
        id: body.botId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    if (bot) {
      const botQuota = await this.prisma.quota.findFirst({
        where: {
          teamId: body.teamId,
          quotaType: 'BOT',
        },
      });

      console.log('bot quota used Value  -->', botQuota.used);

      if (botQuota) {
        await this.prisma.quota.update({
          where: {
            id: botQuota.id,
          },
          data: {
            used: botQuota.used - 1,
          },
        });
      }

      return { message: 'Bot deleted' };
    }
    throw new Error('Error deleting bot');
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

      let activeChat = await this.prisma.customerChats.findFirst({
        where: {
          botId: body.botId,
          teamId: body.teamId,
          chatId: body.chatId,
          isDeleted: false
        }
      });

      if (!activeChat) {
        //get user geolocation from GeoJS
        //https://get.geojs.io/v1/ip/geo.json
        //send request to geojs
        //check local request
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

        activeChat = await this.prisma.customerChats.create({
          data: {
            botId: body.botId,
            teamId: body.teamId,
            chatId: body.chatId,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            CustomerChatDetails: {
              create: {
                sender: body.sender,
                message: body.message,
                createdAt: new Date(body.date),
              }
            },
            GeoLocation: {
              create: {
                ip: geo.data.ip || '',
                country: geo.data.country || '',
                countryCode: geo.data.country_code || '',
                region: geo.data.region || '',
                city: geo.data.city || '',
                latitude: parseFloat(geo.data.latitude) || 0,
                longitude: parseFloat(geo.data.longitude) || 0,
                timezone: geo.data.timezone || '',
                organization: geo.data.organization || '',
                organization_name: geo.data.organization_name || '',
                accuracy: Number(geo.data.accuracy) || 0,
              }
            }
          }
        });
      }
      else {
        activeChat = await this.prisma.customerChats.update({
          where: {
            id: activeChat.id
          },
          data: {
            updatedAt: new Date(),
            CustomerChatDetails: {
              create: {
                sender: body.sender,
                message: body.message,
                createdAt: new Date(body.date),
              }
            }
          }
        });
      }
      if (!activeChat) {
        throw new Error('Error acuring chat');
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

      let data;
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${ingestUrl}/chat`, {
            bot_cuid: botUser.id,
            customer_cuid: botUser.teamId,
            messages: [body.message],
            system_prompt: botUser.systemPrompt,
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

      await this.prisma.customerChats.update({
        where: {
          id: activeChat.id
        },
        data: {
          updatedAt: new Date(),
          totalTokens: tokenCount,
          isDeleted: false,
        }
      });

      const chatDetails = await this.prisma.customerChatDetails.create({
        data: {
          chatId: activeChat.id,
          sender: "bot",
          message: data.content,
          tokenDetails: data.tokens,
          createdAt: new Date(),
        }
      });

      console.log("return data", data)

      return data;
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
      throw new Error('Error acuring bot');
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
