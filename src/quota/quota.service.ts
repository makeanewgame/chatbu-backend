import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QuotaType } from 'src/util/enums';

@Injectable()
export class QuotaService {
    constructor(private prisma: PrismaService) { }

    async list(user: string) {

        const quotas = await this.prisma.quota.findMany({
            where: {
                userId: user
            }
        });

        if (quotas.length > 0) {
            return quotas;
        }

        throw new Error('No quotas found');

    }

    async createDefaultQuotas(userId: string) {

        await this.prisma.quota.create({
            data: {
                user: {
                    connect: {
                        id: userId
                    }
                },
                quotaType: 'BOT',
                limit: 3,
                used: 0
            }
        });

        await this.prisma.quota.create({
            data: {
                user: {
                    connect: {
                        id: userId
                    }
                },
                quotaType: 'FILE',
                limit: 100,
                used: 0
            }
        });

        await this.prisma.quota.create({
            data: {
                user: {
                    connect: {
                        id: userId
                    }
                },
                quotaType: 'TOKEN',
                limit: 20000,
                used: 0
            }
        });

        return { message: 'This action adds a new quota' };
    }

    async updateUsage(userId: string, quotaType: QuotaType, used: number) {

        const quota = await this.prisma.quota.findFirst({
            where: {
                userId: userId,
                quotaType: QuotaType[quotaType]
            }
        });

        if (quota) {
            await this.prisma.quota.update({
                where: {
                    id: quota.id
                },
                data: {
                    used: used
                }
            });

            return { message: 'This action updates the usage of a quota' };
        }

        throw new Error('No quotas found');

    }
}
