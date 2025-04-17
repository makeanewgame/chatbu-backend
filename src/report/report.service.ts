import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReportService {
    constructor(private prisma: PrismaService) { }

    async getChatHistory(user: string) {


        const chatHistoryList = await this.prisma.customerChats.findMany({
            where: {
                userId: user,
            },
            select: {
                id: true,
                userId: true,
                createdAt: true,
                updatedAt: true,
                totalTokens: true,
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

    async getChatHistoryDetail(user: string, chatId: string) {

        const chatHistoryList = await this.prisma.customerChats.findFirst({
            where: {
                userId: user,
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

    async getUserUsage(user: string) {
        const userUsage = await this.prisma.quota.findMany({
            where: {
                userId: user,
            },
            select: {
                id: true,
                quotaType: true,
                limit: true,
                used: true,
            }
        });

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

    async getGeoLocations(user: string) {
        const geoLocation = await this.prisma.customerChats.findMany({
            where: {
                userId: user,
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
}
