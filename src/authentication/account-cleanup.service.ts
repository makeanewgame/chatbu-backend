import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AccountCleanupService {
    private readonly logger = new Logger(AccountCleanupService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Runs daily at 2 AM to permanently delete accounts that have passed their grace period
     * GDPR compliant - respects the 30-day grace period
     */
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async cleanupDeletedAccounts() {
        this.logger.log('Starting account cleanup job...');

        try {
            const now = new Date();

            // Find users whose deletion grace period has expired
            const usersToDelete = await this.prisma.user.findMany({
                where: {
                    isDeleted: true,
                    deletionScheduledFor: {
                        lte: now, // Deletion date has passed
                    },
                },
                select: {
                    id: true,
                    email: true,
                    deletionScheduledFor: true,
                },
            });

            if (usersToDelete.length === 0) {
                this.logger.log('No accounts to delete');
                return;
            }

            this.logger.log(`Found ${usersToDelete.length} accounts to permanently delete`);

            for (const user of usersToDelete) {
                try {
                    await this.permanentlyDeleteUser(user.id);
                    this.logger.log(`Successfully deleted account: ${user.email} (scheduled for: ${user.deletionScheduledFor})`);
                } catch (error) {
                    this.logger.error(`Failed to delete account ${user.email}:`, error);
                }
            }

            this.logger.log('Account cleanup job completed');
        } catch (error) {
            this.logger.error('Error during account cleanup job:', error);
        }
    }

    /**
     * Permanently delete a user and all associated data
     */
    private async permanentlyDeleteUser(userId: string) {
        // Get owned teams
        const ownedTeams = await this.prisma.team.findMany({
            where: {
                ownerId: userId,
            },
            include: {
                members: {
                    where: {
                        status: 'active',
                    },
                },
            },
        });

        // Delete owned teams (cascade will handle related data)
        for (const team of ownedTeams) {
            // Safety check: only delete if no other active members
            const otherMembers = team.members.filter(
                (m) => m.userId !== userId && m.status === 'active',
            );

            if (otherMembers.length > 0) {
                this.logger.warn(
                    `Skipping team ${team.id} deletion - has ${otherMembers.length} active members`,
                );
                continue;
            }

            // Delete the team (cascade will handle CustomerBots, CustomerChats, Storage, Content, Quota, etc.)
            await this.prisma.team.delete({
                where: { id: team.id },
            });

            this.logger.log(`Deleted team ${team.id} for user ${userId}`);
        }

        // Remove user from team memberships (where they are not the owner)
        await this.prisma.teamMember.deleteMany({
            where: {
                userId: userId,
            },
        });

        // Finally, delete the user
        await this.prisma.user.delete({
            where: { id: userId },
        });
    }

    /**
     * Manual trigger for testing (can be called from admin panel)
     */
    async manualCleanup() {
        this.logger.log('Manual account cleanup triggered');
        await this.cleanupDeletedAccounts();
    }
}
