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
        // Stripe v20+: subscription ID moved to invoice.parent.subscription_details.subscription.
        // The raw webhook payload still includes it at the top-level, so we read both.
        const subscriptionId = (
            (invoice as any).subscription ||
            invoice.parent?.subscription_details?.subscription
        ) as string | undefined;

        // Look up by stripeSubscriptionId first (set during createSubscription before payment),
        // fall back to stripeCustomerId for safety.
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                OR: [
                    ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
                    { stripeCustomerId: invoice.customer as string },
                ],
            },
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

        const resolvedSubscriptionId = subscriptionId || subscription.stripeSubscriptionId;
        const stripeSubscription = await this.stripe.subscriptions.retrieve(
            resolvedSubscriptionId,
            { expand: ['items.data.price'] },
        );
        const currentPeriodStart = (stripeSubscription as any).current_period_start
            ? new Date((stripeSubscription as any).current_period_start * 1000)
            : new Date();
        const currentPeriodEnd = (stripeSubscription as any).current_period_end
            ? new Date((stripeSubscription as any).current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // ── First payment: FREE → PREMIUM activation ──────────────────────────
        if (subscription.tier === 'FREE') {
            const billingInterval = (stripeSubscription.metadata?.billingInterval as 'monthly' | 'yearly') || 'monthly';

            const [activePlan, tokenPlan] = await Promise.all([
                this.prisma.pricePlan.findFirst({
                    where: {
                        status: 'ACTIVE',
                        planType: billingInterval === 'yearly' ? 'YEARLY_BASE' : 'MONTHLY_BASE',
                    },
                }),
                this.prisma.pricePlan.findFirst({ where: { status: 'ACTIVE', planType: 'TOKEN_METERED' } }),
            ]);

            const premiumTokenLimit = await this.getPremiumTokenLimit();

            await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    tier: 'PREMIUM',
                    status: 'ACTIVE',
                    stripeSubscriptionId: stripeSubscription.id,
                    currentPeriodStart,
                    currentPeriodEnd,
                    monthlyTokenAllocation: premiumTokenLimit,
                    tokensUsedThisMonth: 0,
                    billingInterval,
                    activePricePlanId: activePlan?.id ?? null,
                    tokenPricePlanId: tokenPlan?.id ?? null,
                },
            });

            // Update team quotas
            const teamMember = await this.prisma.teamMember.findFirst({
                where: { userId: subscription.userId },
            });
            if (teamMember) {
                await Promise.all([
                    this.prisma.quota.updateMany({
                        where: { teamId: teamMember.teamId, quotaType: 'FILE' },
                        data: { limit: 256000 }, // 256 MB
                    }),
                    this.prisma.quota.updateMany({
                        where: { teamId: teamMember.teamId, quotaType: 'BOT' },
                        data: { limit: 10 },
                    }),
                ]);
            }

            this.logger.log(`User ${subscription.userId} upgraded to PREMIUM via webhook (billingInterval=${billingInterval})`);
            return;
        }

        // ── Renewal: reset monthly usage + apply scheduled price migration ────
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

        await this.applyScheduledPriceMigration(subscription, stripeSubscription, currentPeriodStart, currentPeriodEnd);
    }

    /**
     * Eğer abonelik için scheduled fiyat geçişi varsa uygular.
     *
     * Token fiyatı: Her billing döneminde (aylık/yıllık) güncellenir.
     * Base fiyatı:
     *   - Aylık abone → her payment_succeeded'de güncellenir.
     *   - Yıllık abone → yalnızca yıllık dönem yenilendiğinde güncellenir
     *     (currentPeriodEnd - currentPeriodStart ≥ 350 gün).
     */
    private async applyScheduledPriceMigration(
        subscription: any,
        stripeSubscription: Stripe.Subscription,
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
    ) {
        const hasScheduledBase = !!subscription.scheduledPricePlanId;
        const hasScheduledToken = !!subscription.scheduledTokenPlanId;

        if (!hasScheduledBase && !hasScheduledToken) return;

        const isYearly = subscription.billingInterval === 'yearly';
        const periodDays = (currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24);
        const isYearlyRenewal = periodDays >= 350;

        const shouldMigrateBase = hasScheduledBase && (!isYearly || isYearlyRenewal);
        const shouldMigrateToken = hasScheduledToken; // Her zaman

        if (!shouldMigrateBase && !shouldMigrateToken) {
            this.logger.log(`Skipping base price migration for yearly subscriber ${subscription.userId} — not a yearly renewal`);
            return;
        }

        try {
            const newDbUpdates: any = {};

            if (shouldMigrateBase) {
                const newBasePlan = await this.prisma.pricePlan.findUnique({
                    where: { id: subscription.scheduledPricePlanId },
                });
                if (newBasePlan?.stripePriceId) {
                    const baseItem = stripeSubscription.items.data.find(
                        (item) => item.price.recurring?.usage_type === 'licensed',
                    );
                    if (baseItem) {
                        await this.stripe.subscriptionItems.update(baseItem.id, {
                            price: newBasePlan.stripePriceId,
                            proration_behavior: 'none',
                        });
                        this.logger.log(`Migrated base price for user ${subscription.userId} → ${newBasePlan.stripePriceId}`);
                    }
                    newDbUpdates.activePricePlanId = subscription.scheduledPricePlanId;
                    newDbUpdates.scheduledPricePlanId = null;
                }
            }

            if (shouldMigrateToken) {
                const newTokenPlan = await this.prisma.pricePlan.findUnique({
                    where: { id: subscription.scheduledTokenPlanId },
                });
                if (newTokenPlan?.stripePriceId) {
                    const tokenItem = stripeSubscription.items.data.find(
                        (item) => item.price.recurring?.usage_type === 'metered',
                    );
                    if (tokenItem) {
                        await this.stripe.subscriptionItems.update(tokenItem.id, {
                            price: newTokenPlan.stripePriceId,
                            proration_behavior: 'none',
                        });
                        this.logger.log(`Migrated token price for user ${subscription.userId} → ${newTokenPlan.stripePriceId}`);
                    }
                    newDbUpdates.tokenPricePlanId = subscription.scheduledTokenPlanId;
                    newDbUpdates.scheduledTokenPlanId = null;
                }
            }

            if (Object.keys(newDbUpdates).length > 0) {
                await this.prisma.subscription.update({
                    where: { id: subscription.id },
                    data: newDbUpdates,
                });
            }
        } catch (err) {
            this.logger.error(`Price migration failed for user ${subscription.userId}:`, err);
        }
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

        // 'trialing' and 'active' are both considered ACTIVE on our side.
        // 'incomplete' means user hasn't paid yet — do not flip status.
        const activeStatuses = ['active', 'trialing'];
        const dbStatus = activeStatuses.includes(stripeSubscription.status) ? 'ACTIVE' : 'INACTIVE';

        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: dbStatus,
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

        const freeTokenLimit = await this.getFreeTokenLimit();

        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                tier: 'FREE',
                status: 'INACTIVE',
                stripeSubscriptionId: null,
                monthlyTokenAllocation: freeTokenLimit,
                tokensUsedThisMonth: 0,
                additionalTokensPurchased: 0,
            },
        });

        // Reset team quotas back to FREE limits
        const teamMember = await this.prisma.teamMember.findFirst({
            where: { userId: subscription.userId },
        });
        if (teamMember) {
            await Promise.all([
                this.prisma.quota.updateMany({
                    where: { teamId: teamMember.teamId, quotaType: 'FILE' },
                    data: { limit: 50000 }, // 50 MB for FREE users
                }),
                this.prisma.quota.updateMany({
                    where: { teamId: teamMember.teamId, quotaType: 'BOT' },
                    data: { limit: 1 }, // 1 Bot for FREE users
                }),
            ]);
        }

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

    private async getFreeTokenLimit(): Promise<number> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: 'FREE_TOKEN_LIMIT' },
        });
        return setting ? parseInt(setting.value) : 100000;
    }

    private async getPremiumTokenLimit(): Promise<number> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: 'PREMIUM_MONTHLY_TOKEN_LIMIT' },
        });
        return setting ? parseInt(setting.value) : 2000000;
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
