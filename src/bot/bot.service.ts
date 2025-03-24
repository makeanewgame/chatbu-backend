import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBotRequest } from './dto/createBotRequest';
import { DeleteBotRequest } from './dto/deleteBotRequest';
import { ChageStatusBotRequest } from './dto/changeStatusBotRequest';
import { RenameBotRequest } from './dto/renameBotRequest';
import { QuotaType } from 'src/util/enums';
import { debug } from 'console';

@Injectable()
export class BotService {
    constructor(private prisma: PrismaService) { }

    async createBot(body: CreateBotRequest) {

        const user = await this.prisma.user.findUnique({
            where: {
                id: body.user
            }
        });

        if (!user) {
            throw new Error('Error acuring user');
        }

        //bot quota for user

        const bots = await this.prisma.customerBots.findMany({
            where: {
                userId: body.user,
                isDeleted: false
            }
        });

        console.log("user bots  -->", bots);

        const botQuota = await this.prisma.quota.findFirst({
            where: {
                userId: body.user,
                quotaType: "BOT"
            }
        });


        console.log("bot quota  -->", botQuota);


        if (botQuota) {
            if (bots.length >= botQuota.limit) {
                throw new ForbiddenException('Bot quota exceeded');
            }

            else if (bots.length < botQuota.limit) {
                console.log("bot creation...", body.systemPrompt);

                const bot = await this.prisma.customerBots.create({
                    data: {
                        botName: body.botName,
                        botAvatar: body.botAvatar.toString(),
                        systemPrompt: body.systemPrompt,
                        user: {
                            connect: {
                                id: body.user
                            }
                        }
                    }
                })

                if (bot) {
                    await this.prisma.quota.update({
                        where: {
                            id: botQuota.id
                        },
                        data: {
                            used: botQuota.used + 1
                        }
                    });

                    return { message: 'Bot created' };
                }
                throw new Error('Error creating bot');

            }
        }
        throw new ForbiddenException('Error creating bot');
    }

    async deleteBot(body: DeleteBotRequest) {

        const findUser = await this.prisma.user.findUnique({
            where: {
                id: body.userId
            }
        });

        if (!findUser) {
            throw new Error('Error acuring user');
        }

        const bot = await this.prisma.customerBots.update({
            where: {
                userId: body.userId,
                id: body.botId
            },
            data: {
                isDeleted: true,
                deletedAt: new Date()
            }
        });

        if (bot) {

            const botQuota = await this.prisma.quota.findFirst({
                where: {
                    userId: body.userId,
                    quotaType: "BOT"
                }
            });

            console.log("bot quota used Value  -->", botQuota.used);

            if (botQuota) {
                await this.prisma.quota.update({
                    where: {
                        id: botQuota.id
                    },
                    data: {
                        used: (botQuota.used - 1)
                    }
                });
            }

            return { message: 'Bot deleted' };
        }
        throw new Error('Error deleting bot');

    }

    async listBots(user: string) {
        const findUser = await this.prisma.user.findUnique({
            where: {
                id: user
            }
        });

        if (!findUser) {
            throw new Error('Error acuring user');
        }


        const bots = await this.prisma.customerBots.findMany({
            where: {
                userId: user,
                isDeleted: false
            }
        });


        if (bots) {
            return bots;
        }
        throw new Error('Error listing bots');

    }

    async renameBot(body: RenameBotRequest) {

        const findUser = await this.prisma.user.findUnique({
            where: {
                id: body.userId
            }
        });

        if (!findUser) {
            throw new Error('Error acuring user');
        }


        const bot = await this.prisma.customerBots.update({
            where: {
                userId: body.userId,
                id: body.botId
            },
            data: {
                botName: body.name,
                systemPrompt: body.systemPrompt
            }
        });

        if (bot) {
            return { message: 'Bot name changed' };
        }
        throw new Error('Error changing bot name');

    }

    async changeStatus(body: ChageStatusBotRequest) {

        const findUser = await this.prisma.user.findUnique({
            where: {
                id: body.userId
            }
        });

        if (!findUser) {
            throw new Error('Error acuring user');
        }

        const bot = await this.prisma.customerBots.update({
            where: {
                userId: body.userId,
                id: body.botId
            },
            data: {
                active: !body.active
            }
        });

        if (bot) {
            return { message: 'Bot status changed' };
        }
        throw new Error('Error changing bot status');

    }
}
