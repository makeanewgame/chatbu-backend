import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QuotaType } from 'src/util/enums';

@Injectable()
export class QuotaService {
    constructor(private prisma: PrismaService) { }

    async list(team: string) {

        const quotas = await this.prisma.quota.findMany({
            where: {
                teamId: team
            }
        });

        if (quotas.length > 0) {
            return quotas;
        }

        throw new Error('No quotas found');

    }

    async createDefaultQuotas(teamId: string, userId: string) {
        // Get user's subscription to determine limits
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        const isFree = !subscription || subscription.tier === 'FREE';

        // Get limits from system settings
        const freeBotLimit = await this.getSettingValue('FREE_BOT_LIMIT', '1');
        const premiumBotLimit = await this.getSettingValue('PREMIUM_BOT_LIMIT', '10');
        const botLimit = isFree ? parseInt(freeBotLimit) : parseInt(premiumBotLimit);

        await this.prisma.quota.create({
            data: {
                team: {
                    connect: {
                        id: teamId
                    }
                },
                quotaType: 'BOT',
                limit: botLimit,
                used: 0
            }
        });

        await this.prisma.quota.create({
            data: {
                team: {
                    connect: {
                        id: teamId
                    }
                },
                quotaType: 'FILE',
                limit: isFree
                    ? parseInt(await this.getSettingValue('FREE_STORAGE_LIMIT_KB', '10240'))
                    : parseInt(await this.getSettingValue('PREMIUM_STORAGE_LIMIT_KB', '256000')),
                used: 0
            }
        });

        return { message: 'This action adds a new quota' };
    }

    async updateUsage(userId: string, quotaType: QuotaType, used: number) {

        const quota = await this.prisma.quota.findFirst({
            where: {
                teamId: userId,
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

    async updateBotQuotaLimits(userId: string) {
        // Update bot quota limits when user upgrades/downgrades
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        const teams = await this.prisma.team.findMany({
            where: { ownerId: userId },
        });

        const isFree = !subscription || subscription.tier === 'FREE';
        const freeBotLimit = await this.getSettingValue('FREE_BOT_LIMIT', '1');
        const premiumBotLimit = await this.getSettingValue('PREMIUM_BOT_LIMIT', '10');
        const botLimit = isFree ? parseInt(freeBotLimit) : parseInt(premiumBotLimit);

        for (const team of teams) {
            const quota = await this.prisma.quota.findFirst({
                where: {
                    teamId: team.id,
                    quotaType: 'BOT',
                },
            });

            if (quota) {
                await this.prisma.quota.update({
                    where: { id: quota.id },
                    data: { limit: botLimit },
                });
            }
        }
    }

    async updateStorageQuotaLimits(userId: string) {
        // Update FILE quota limits when user upgrades/downgrades (KB-based)
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        const teams = await this.prisma.team.findMany({
            where: { ownerId: userId },
        });

        const isFree = !subscription || subscription.tier === 'FREE';
        const freeLimit = parseInt(await this.getSettingValue('FREE_STORAGE_LIMIT_KB', '10240'));
        const premiumLimit = parseInt(await this.getSettingValue('PREMIUM_STORAGE_LIMIT_KB', '256000'));
        const storageLimit = isFree ? freeLimit : premiumLimit;

        for (const team of teams) {
            const quota = await this.prisma.quota.findFirst({
                where: { teamId: team.id, quotaType: 'FILE' },
            });
            if (quota) {
                await this.prisma.quota.update({
                    where: { id: quota.id },
                    data: { limit: storageLimit },
                });
            }
        }
    }

    async addStorageUsageKb(teamId: string, additionalKb: number): Promise<void> {
        // Atomically increment FILE quota used by additionalKb.
        // Called by ML service callback after ingestion completes.
        const quota = await this.prisma.quota.findFirst({
            where: { teamId, quotaType: 'FILE' },
        });
        if (quota) {
            await this.prisma.quota.update({
                where: { id: quota.id },
                data: { used: Math.max(0, quota.used + additionalKb) },
            });
        }
    }

    async subtractStorageUsageKb(teamId: string, kbToRemove: number): Promise<void> {
        // Decrement FILE quota used when content is deleted.
        const quota = await this.prisma.quota.findFirst({
            where: { teamId, quotaType: 'FILE' },
        });
        if (quota) {
            await this.prisma.quota.update({
                where: { id: quota.id },
                data: { used: Math.max(0, quota.used - kbToRemove) },
            });
        }
    }

    async checkStorageQuota(teamId: string, estimatedKb: number): Promise<{
        allowed: boolean;
        usedKb: number;
        limitKb: number;
        remainingKb: number;
    }> {
        const quota = await this.prisma.quota.findFirst({
            where: { teamId, quotaType: 'FILE' },
        });
        if (!quota) {
            return { allowed: false, usedKb: 0, limitKb: 0, remainingKb: 0 };
        }
        const remainingKb = Math.max(quota.limit - quota.used, 0);
        return {
            allowed: quota.used + estimatedKb <= quota.limit,
            usedKb: quota.used,
            limitKb: quota.limit,
            remainingKb,
        };
    }

    private async getSettingValue(key: string, defaultValue: string): Promise<string> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key },
        });
        return setting ? setting.value : defaultValue;
    }

    async incrementQuota(teamId: string, quotaType: QuotaType, amount: number = 1) {
        const quota = await this.prisma.quota.findFirst({
            where: {
                teamId: teamId,
                quotaType: QuotaType[quotaType]
            }
        });

        if (quota) {
            await this.prisma.quota.update({
                where: {
                    id: quota.id
                },
                data: {
                    used: quota.used + amount
                }
            });

            return {
                message: 'Quota incremented successfully',
                used: quota.used + amount,
                remaining: quota.limit - (quota.used + amount)
            };
        }

        throw new Error('No quota found');
    }

    async decrementQuota(teamId: string, quotaType: QuotaType, amount: number = 1) {
        const quota = await this.prisma.quota.findFirst({
            where: {
                teamId: teamId,
                quotaType: QuotaType[quotaType]
            }
        });

        if (quota) {
            const newUsed = Math.max(0, quota.used - amount);
            await this.prisma.quota.update({
                where: {
                    id: quota.id
                },
                data: {
                    used: newUsed
                }
            });

            return {
                message: 'Quota decremented successfully',
                used: newUsed,
                remaining: quota.limit - newUsed
            };
        }

        throw new Error('No quota found');
    }
}

