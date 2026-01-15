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

    // Cron job to check for upcoming billing and send reminders
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async sendPaymentReminders() {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const subscriptions = await this.prisma.subscription.findMany({
            where: {
                tier: 'PREMIUM',
                status: 'ACTIVE',
                currentPeriodEnd: {
                    lte: threeDaysFromNow,
                    gte: new Date(),
                },
            },
            include: {
                user: true,
            },
        });

        for (const subscription of subscriptions) {
            // Send reminder email 3 days before renewal
            await this.mailService.sendPaymentReminderEmail(
                subscription.user.email,
                subscription.user.name,
                subscription.currentPeriodEnd,
            );

            this.logger.log(`Payment reminder sent to user ${subscription.userId}`);
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
        });

        if (!subscription?.stripeCustomerId) {
            return [];
        }

        try {
            // Get invoices from Stripe
            const invoices = await this.stripe.invoices.list({
                customer: subscription.stripeCustomerId,
                limit: 100,
            });

            return invoices.data.map(invoice => ({
                id: invoice.id,
                number: invoice.number,
                amount: invoice.amount_paid / 100, // Convert from cents
                currency: invoice.currency,
                status: invoice.status?.toUpperCase(),
                billingPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
                billingPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
                paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
                invoicePdf: invoice.invoice_pdf,
                hostedInvoiceUrl: invoice.hosted_invoice_url,
            }));
        } catch (error) {
            this.logger.error('Error fetching Stripe invoices:', error);
            return [];
        }
    }
}
