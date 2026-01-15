import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);
    private stripe: Stripe;

    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        private config: ConfigService,
    ) {
        const stripeKey = this.config.get('STRIPE_SECRET_KEY');
        if (stripeKey) {
            this.stripe = new Stripe(stripeKey);
        }
    }

    async handleWebhook(event: Stripe.Event) {
        switch (event.type) {
            case 'invoice.payment_succeeded':
                await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;
            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
        }
    }

    private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
        const subscription = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: invoice.customer as string },
            include: { user: true },
        });

        if (!subscription) return;

        // Update invoice status
        await this.prisma.invoice.updateMany({
            where: { stripeInvoiceId: invoice.id },
            data: {
                status: 'PAID',
                paidAt: new Date(),
            },
        });

        // Unblock account if blocked
        if (subscription.user.accountBlocked) {
            await this.prisma.user.update({
                where: { id: subscription.userId },
                data: {
                    accountBlocked: false,
                    blockedAt: null,
                    blockedReason: null,
                },
            });

            this.logger.log(`Account unblocked for user ${subscription.userId}`);
        }

        // Reset monthly usage for new period
        const stripeSubscription = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        const currentPeriodStart = (stripeSubscription as any).current_period_start
            ? new Date((stripeSubscription as any).current_period_start * 1000)
            : new Date();
        const currentPeriodEnd = (stripeSubscription as any).current_period_end
            ? new Date((stripeSubscription as any).current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: 'ACTIVE',
                tokensUsedThisMonth: 0,
                additionalTokensPurchased: 0,
                currentPeriodStart,
                currentPeriodEnd,
            },
        });
    }

    private async handlePaymentFailed(invoice: Stripe.Invoice) {
        const subscription = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: invoice.customer as string },
            include: { user: true },
        });

        if (!subscription) return;

        // Update invoice status
        await this.prisma.invoice.updateMany({
            where: { stripeInvoiceId: invoice.id },
            data: {
                status: 'UNCOLLECTIBLE',
                attemptedAt: new Date(),
                failureReason: invoice.last_finalization_error?.message,
            },
        });

        // Block account
        await this.prisma.user.update({
            where: { id: subscription.userId },
            data: {
                accountBlocked: true,
                blockedAt: new Date(),
                blockedReason: 'Payment failed',
            },
        });

        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: 'PAST_DUE',
            },
        });

        // Send email notification
        await this.mailService.sendPaymentFailedEmail(subscription.user.email, subscription.user.name);

        this.logger.warn(`Payment failed for user ${subscription.userId}. Account blocked.`);
    }

    private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
        const subscription = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubscription.id },
        });

        if (!subscription) return;

        const currentPeriodStart = (stripeSubscription as any).current_period_start
            ? new Date((stripeSubscription as any).current_period_start * 1000)
            : subscription.currentPeriodStart || new Date();
        const currentPeriodEnd = (stripeSubscription as any).current_period_end
            ? new Date((stripeSubscription as any).current_period_end * 1000)
            : subscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: stripeSubscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
                currentPeriodStart,
                currentPeriodEnd,
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            },
        });
    }

    private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
        const subscription = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubscription.id },
        });

        if (!subscription) return;

        // Downgrade to FREE
        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                tier: 'FREE',
                status: 'INACTIVE',
                stripeSubscriptionId: null,
                monthlyTokenAllocation: await this.getFreeTokenLimit(),
                tokensUsedThisMonth: 0,
                additionalTokensPurchased: 0,
            },
        });

        this.logger.log(`Subscription deleted for user ${subscription.userId}. Downgraded to FREE.`);
    }

    async createMonthlyInvoice(subscriptionId: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
        });

        if (!subscription) return;

        const subscriptionWithLogs = await this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: {
                tokenUsageLogs: {
                    where: {
                        createdAt: {
                            gte: subscription.currentPeriodStart,
                            lt: subscription.currentPeriodEnd,
                        },
                    },
                },
            },
        });

        const totalCost = subscriptionWithLogs.tokenUsageLogs.reduce((sum, log) => sum + log.cost, 0);
        const tokensCharged = subscriptionWithLogs.tokenUsageLogs.reduce((sum, log) => sum + log.tokensUsed, 0);

        const invoice = await this.prisma.invoice.create({
            data: {
                subscriptionId: subscription.id,
                amount: totalCost,
                tokensCharged,
                billingPeriodStart: subscription.currentPeriodStart,
                billingPeriodEnd: subscription.currentPeriodEnd,
                dueDate: subscription.currentPeriodEnd,
                status: 'OPEN',
            },
        });

        return invoice;
    }

    // Cron job to check for upcoming billing and send reminders
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async sendPaymentReminders() {
        const fiveDaysFromNow = new Date();
        fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

        const subscriptions = await this.prisma.subscription.findMany({
            where: {
                tier: 'PREMIUM',
                status: 'ACTIVE',
                currentPeriodEnd: {
                    lte: fiveDaysFromNow,
                    gte: new Date(),
                },
            },
            include: {
                user: true,
                invoices: {
                    where: {
                        status: 'OPEN',
                        reminderSentAt: null,
                    },
                },
            },
        });

        for (const subscription of subscriptions) {
            if (subscription.invoices.length > 0) {
                await this.mailService.sendPaymentReminderEmail(
                    subscription.user.email,
                    subscription.user.name,
                    subscription.currentPeriodEnd,
                );

                // Mark reminder as sent
                await this.prisma.invoice.updateMany({
                    where: {
                        subscriptionId: subscription.id,
                        status: 'OPEN',
                    },
                    data: {
                        reminderSentAt: new Date(),
                    },
                });

                this.logger.log(`Payment reminder sent to user ${subscription.userId}`);
            }
        }
    }

    // Cron job to handle subscription renewals
    @Cron(CronExpression.EVERY_HOUR)
    async processSubscriptionRenewals() {
        const now = new Date();
        const subscriptions = await this.prisma.subscription.findMany({
            where: {
                tier: 'PREMIUM',
                status: 'ACTIVE',
                currentPeriodEnd: {
                    lte: now,
                },
            },
            include: { user: true },
        });

        for (const subscription of subscriptions) {
            try {
                // Stripe handles automatic renewals, we just need to check if payment succeeded
                const stripeSubscription = await this.stripe.subscriptions.retrieve(
                    subscription.stripeSubscriptionId,
                );

                if (stripeSubscription.status !== 'active') {
                    // Payment failed, block account
                    await this.prisma.user.update({
                        where: { id: subscription.userId },
                        data: {
                            accountBlocked: true,
                            blockedAt: new Date(),
                            blockedReason: 'Subscription payment failed',
                        },
                    });

                    await this.prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            status: 'PAST_DUE',
                        },
                    });

                    this.logger.warn(`Subscription renewal failed for user ${subscription.userId}`);
                }
            } catch (error) {
                this.logger.error(`Error processing renewal for subscription ${subscription.id}`, error);
            }
        }
    }

    private async getFreeTokenLimit(): Promise<number> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: 'FREE_TOKEN_LIMIT' },
        });
        return setting ? parseInt(setting.value) : 100000;
    }

    async getUserInvoices(userId: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                invoices: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        return subscription?.invoices || [];
    }
}
