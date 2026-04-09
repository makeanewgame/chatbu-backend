import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReportService {
    constructor(private prisma: PrismaService) { }

    async getChatHistory(teamId: string) {


        const chatHistoryList = await this.prisma.customerChats.findMany({
            where: {
                teamId: teamId,
            },
            select: {
                id: true,
                teamId: true,
                createdAt: true,
                updatedAt: true,
                totalTokens: true,
                botId: true,
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

        return chatHistoryList;
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

        return chatHistoryList;
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
}
