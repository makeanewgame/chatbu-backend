import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { SystemLogService } from 'src/system-log/system-log.service';
import { PricePlanService } from './price-plan.service';
import { StripeBootstrapService } from './stripe-bootstrap.service';

@Injectable()
export class SubscriptionService {
    private stripe: Stripe;

    constructor(
        private prisma: PrismaService,
        private config: ConfigService,
        private systemLogService: SystemLogService,
        private pricePlanService: PricePlanService,
        private stripeBootstrap: StripeBootstrapService,
    ) {
        const stripeKey = this.config.get('STRIPE_SECRET_KEY');
        if (stripeKey) {
            this.stripe = new Stripe(stripeKey);
        }
    }

    async getOrCreateSubscription(userId: string) {
        if (!userId) {
            throw new BadRequestException('User ID is required');
        }

        // Check if subscription exists first
        let subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                user: true,
            },
        });

        // Create if doesn't exist
        if (!subscription) {
            subscription = await this.prisma.subscription.create({
                data: {
                    userId,
                    tier: 'FREE',
                    status: 'ACTIVE',
                    monthlyTokenAllocation: await this.getFreeTokenLimit(),
                    tokensUsedThisMonth: 0,
                },
                include: {
                    user: true,
                },
            });
        }

        // Fetch payment method details from Stripe if available
        let paymentMethod = null;
        let nextBillingAmount: number | null = null;
        let nextBillingCurrency: string | null = null;
        if (subscription.stripeCustomerId && this.stripe) {
            try {
                const customer = await this.stripe.customers.retrieve(subscription.stripeCustomerId) as Stripe.Customer;
                if (customer && 'deleted' in customer === false && customer.invoice_settings?.default_payment_method) {
                    const pmId = typeof customer.invoice_settings.default_payment_method === 'string'
                        ? customer.invoice_settings.default_payment_method
                        : customer.invoice_settings.default_payment_method.id;

                    const pm = await this.stripe.paymentMethods.retrieve(pmId);
                    if (pm.card) {
                        paymentMethod = {
                            brand: pm.card.brand,
                            last4: pm.card.last4,
                            expMonth: pm.card.exp_month,
                            expYear: pm.card.exp_year,
                        };
                    }
                }
            } catch (error) {
                console.error('Error fetching payment method:', error);
            }

            // Fetch upcoming invoice amount from Stripe
            try {
                if (subscription.stripeSubscriptionId) {
                    const stripeSub = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
                    if (stripeSub.status !== 'canceled') {
                        const upcomingInvoice = await this.stripe.invoices.createPreview({
                            customer: subscription.stripeCustomerId,
                            subscription: subscription.stripeSubscriptionId,
                        });
                        nextBillingAmount = upcomingInvoice.amount_due / 100;
                        nextBillingCurrency = upcomingInvoice.currency;
                    }
                }
            } catch (error) {
                // No upcoming invoice (e.g. no active Stripe subscription) — ignore
            }
        }

        return {
            ...subscription,
            paymentMethod,
            nextBillingAmount,
            nextBillingCurrency,
        };
    }

    async createSubscription(userId: string, billingInfo: any, planDetails: any) {
        console.log('createSubscription called');
        const subscription = await this.getOrCreateSubscription(userId);
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Allow re-entry if previous attempt left an incomplete subscription
        if (subscription.tier === 'PREMIUM' && subscription.stripeSubscriptionId) {
            throw new BadRequestException('Already a premium member');
        }

        // Create or get Stripe customer
        // Always verify that the stored stripeCustomerId actually exists in the current
        // Stripe environment (live vs test keys may differ — old test IDs are invalid in live).
        let stripeCustomerId = subscription.stripeCustomerId;
        if (stripeCustomerId) {
            try {
                const existing = await this.stripe.customers.retrieve(stripeCustomerId);
                if ((existing as any).deleted) {
                    console.log('Stripe customer deleted, will create new:', stripeCustomerId);
                    stripeCustomerId = null;
                    await this.prisma.subscription.update({ where: { userId }, data: { stripeCustomerId: null } });
                }
            } catch (err: any) {
                // customer not found in current Stripe environment (e.g. test ID used with live keys)
                console.log('Stripe customer not found, will create new:', stripeCustomerId, err?.message);
                stripeCustomerId = null;
                await this.prisma.subscription.update({ where: { userId }, data: { stripeCustomerId: null } });
            }
        }
        if (!stripeCustomerId) {
            const customerEmail = billingInfo.email || user.email;

            // Check if customer already exists in Stripe with this email
            const existingCustomers = await this.stripe.customers.list({
                email: customerEmail,
                limit: 1,
            });

            if (existingCustomers.data.length > 0) {
                // Use existing customer
                stripeCustomerId = existingCustomers.data[0].id;
                console.log('Using existing Stripe customer:', stripeCustomerId, 'for email:', customerEmail);

                // Update customer info if needed
                await this.stripe.customers.update(stripeCustomerId, {
                    name: `${billingInfo.firstName} ${billingInfo.lastName}`,
                    metadata: {
                        userId: user.id,
                    },
                    address: {
                        line1: billingInfo.billingAddress,
                        city: billingInfo.city,
                        state: billingInfo.stateRegion,
                        postal_code: billingInfo.zipCode,
                        country: billingInfo.country,
                    },
                });
            } else {
                // Create new customer
                console.log('Creating new Stripe customer for email:', customerEmail);
                const customer = await this.stripe.customers.create({
                    email: customerEmail,
                    name: `${billingInfo.firstName} ${billingInfo.lastName}`,
                    metadata: {
                        userId: user.id,
                    },
                    address: {
                        line1: billingInfo.billingAddress,
                        city: billingInfo.city,
                        state: billingInfo.stateRegion,
                        postal_code: billingInfo.zipCode,
                        country: billingInfo.country,
                    },
                });
                stripeCustomerId = customer.id;
            }

            // Update subscription with Stripe customer ID
            await this.prisma.subscription.update({
                where: { userId },
                data: { stripeCustomerId },
            });
        }

        // Save billing info
        await this.prisma.billingInfo.upsert({
            where: { userId },
            create: {
                userId,
                firstName: billingInfo.firstName,
                lastName: billingInfo.lastName || '',
                email: billingInfo.email,
                address: billingInfo.billingAddress,
                city: billingInfo.city || '',
                stateRegion: billingInfo.stateRegion,
                zipPostalCode: billingInfo.zipCode,
                country: billingInfo.country,
                isCompany: billingInfo.isCompany || false,
                vatIdentificationNumber: billingInfo.vatId || null,
            },
            update: {
                firstName: billingInfo.firstName,
                lastName: billingInfo.lastName || '',
                email: billingInfo.email,
                address: billingInfo.billingAddress,
                city: billingInfo.city || '',
                stateRegion: billingInfo.stateRegion,
                zipPostalCode: billingInfo.zipCode,
                country: billingInfo.country,
                isCompany: billingInfo.isCompany || false,
                vatIdentificationNumber: billingInfo.vatId || null,
            },
        });

        // Always USD — currency is not accepted from the frontend
        const isAnnual = planDetails.isAnnual || false;
        const billingInterval: 'monthly' | 'yearly' = planDetails.billingInterval || (isAnnual ? 'yearly' : 'monthly');
        const basePriceId = await this.getBasePriceId(billingInterval);
        const meteredPriceId = await this.getMeteredPriceId();

        // If a previous attempt left an incomplete subscription, cancel it so Stripe
        // doesn't accumulate orphaned subscriptions for the same customer.
        if (subscription.stripeSubscriptionId) {
            try {
                const existing = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
                if (existing.status === 'incomplete') {
                    await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
                    await this.prisma.subscription.update({
                        where: { userId },
                        data: { stripeSubscriptionId: null },
                    });
                }
            } catch (_) {
                // Subscription not found in Stripe — clear stale ID
                await this.prisma.subscription.update({
                    where: { userId },
                    data: { stripeSubscriptionId: null },
                });
            }
        }

        const createStripeSubscription = async (customerId: string) => {
            return this.stripe.subscriptions.create({
                customer: customerId,
                items: [
                    { price: basePriceId },
                    { price: meteredPriceId },
                ],
                payment_behavior: 'default_incomplete',
                payment_settings: {
                    save_default_payment_method: 'on_subscription',
                },
                expand: ['latest_invoice.confirmation_secret'],
                metadata: {
                    userId: user.id,
                    billingInterval,
                },
            });
        };

        let stripeSubscription: Stripe.Subscription;
        try {
            stripeSubscription = await createStripeSubscription(stripeCustomerId);
        } catch (err: any) {
            // Stripe rejects mixing currencies on a customer that has existing TRY items/subscriptions.
            // In this case we create a fresh customer in USD and retry.
            if (err?.raw?.code === 'currency_combination_invalid' || err?.message?.includes('cannot combine currencies')) {
                console.log(`Currency mismatch on customer ${stripeCustomerId}, creating a new USD customer`);
                const freshCustomer = await this.stripe.customers.create({
                    email: billingInfo.email || user.email,
                    name: `${billingInfo.firstName} ${billingInfo.lastName || ''}`.trim(),
                    metadata: { userId: user.id },
                    address: {
                        line1: billingInfo.billingAddress,
                        city: billingInfo.city,
                        state: billingInfo.stateRegion,
                        postal_code: billingInfo.zipCode,
                        country: billingInfo.country,
                    },
                });
                stripeCustomerId = freshCustomer.id;
                await this.prisma.subscription.update({
                    where: { userId },
                    data: { stripeCustomerId },
                });
                stripeSubscription = await createStripeSubscription(stripeCustomerId);
            } else {
                throw err;
            }
        }

        // Persist stripeSubscriptionId immediately so the webhook handler can find
        // this record when invoice.payment_succeeded fires.
        await this.prisma.subscription.update({
            where: { userId },
            data: {
                stripeSubscriptionId: stripeSubscription.id,
                stripeCustomerId,
                billingInterval,
            },
        });

        const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
        // Stripe v20+: client_secret is in confirmation_secret.client_secret
        const clientSecret = latestInvoice.confirmation_secret?.client_secret;

        if (!clientSecret) {
            throw new Error('Failed to retrieve payment client secret from Stripe');
        }

        return {
            clientSecret,
            subscriptionId: stripeSubscription.id,
        };
    }

    async cancelSubscription(userId: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription || subscription.tier !== 'PREMIUM') {
            throw new BadRequestException('No active premium subscription');
        }

        if (subscription.stripeSubscriptionId) {
            await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                cancel_at_period_end: true,
            });
        }

        await this.prisma.subscription.update({
            where: { userId },
            data: {
                cancelAtPeriodEnd: true,
            },
        });

        await this.systemLogService.createLog({
            category: 'STRIPE',
            action: 'UNSUBSCRIBE',
            status: 'SUCCESS',
            userId,
            message: `Subscription cancellation requested`,
        });

        return { message: 'Subscription will be cancelled at period end' };
    }

    async purchaseTokens(userId: string, tokenAmount: number) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription || subscription.tier !== 'PREMIUM') {
            throw new BadRequestException('Only premium members can purchase additional tokens');
        }

        const tokenPrice = await this.getTokenPrice();
        const cost = (tokenAmount / 1000) * tokenPrice;

        // Check spending limit
        if (subscription.spendingLimit) {
            const currentMonthCost = await this.getCurrentMonthCost(userId);
            if (currentMonthCost + cost > subscription.spendingLimit) {
                throw new BadRequestException('Spending limit exceeded');
            }
        }

        await this.prisma.subscription.update({
            where: { userId },
            data: {
                additionalTokensPurchased: subscription.additionalTokensPurchased + tokenAmount,
            },
        });

        // Log usage
        await this.prisma.tokenUsageLog.create({
            data: {
                subscriptionId: subscription.id,
                tokensUsed: tokenAmount,
                cost,
            },
        });

        return { message: 'Tokens purchased successfully', tokens: tokenAmount };
    }

    async setSpendingLimit(userId: string, spendingLimit: number) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription || subscription.tier !== 'PREMIUM') {
            throw new BadRequestException('Only premium members can set spending limits');
        }

        if (spendingLimit <= 0) {
            throw new BadRequestException('Spending limit must be greater than 0');
        }

        if (spendingLimit > 10000) {
            throw new BadRequestException('Maximum spending limit is $10,000 per month');
        }

        await this.prisma.subscription.update({
            where: { userId },
            data: {
                spendingLimit,
            },
        });

        return { message: 'Spending limit updated successfully', spendingLimit };
    }

    async createSetupIntent(userId: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription || !subscription.stripeCustomerId) {
            throw new BadRequestException('No customer found');
        }

        const setupIntent = await this.stripe.setupIntents.create({
            customer: subscription.stripeCustomerId,
            payment_method_types: ['card'],
        });

        return { clientSecret: setupIntent.client_secret };
    }

    async updatePaymentMethod(userId: string, paymentMethodId: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription || !subscription.stripeCustomerId) {
            throw new BadRequestException('No customer found');
        }

        // Attach payment method to customer
        await this.stripe.paymentMethods.attach(paymentMethodId, {
            customer: subscription.stripeCustomerId,
        });

        // Set as default payment method
        await this.stripe.customers.update(subscription.stripeCustomerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Update subscription's default payment method
        if (subscription.stripeSubscriptionId) {
            await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                default_payment_method: paymentMethodId,
            });
        }

        return { message: 'Payment method updated successfully' };
    }

    async checkTokenQuota(userId: string): Promise<{ allowed: boolean; message?: string; tokensRemaining?: number; spendingLimit?: number; tier?: string }> {
        const subscription = await this.getOrCreateSubscription(userId);
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        // Check if account is blocked
        if (user?.accountBlocked) {
            return {
                allowed: false,
                message: 'Your account is blocked due to payment issues. Please update your payment method.',
            };
        }

        const totalAvailable = subscription.monthlyTokenAllocation + subscription.additionalTokensPurchased;
        const remaining = totalAvailable - subscription.tokensUsedThisMonth;

        if (remaining <= 0) {
            if (subscription.tier === 'FREE') {
                await this.systemLogService.createLog({
                    category: 'STRIPE',
                    action: 'QUOTA_EXCEEDED',
                    status: 'ERROR',
                    userId,
                    message: `Free token quota exceeded`,
                    details: { tier: 'FREE', tokensUsed: subscription.tokensUsedThisMonth, limit: totalAvailable },
                });
                return {
                    allowed: false,
                    message: 'You have reached your token limit. Please upgrade to Premium to continue.',
                    tokensRemaining: 0,
                    tier: subscription.tier,
                };
            } else {
                // Premium user - check spending limit
                if (subscription.spendingLimit) {
                    const currentCost = await this.getCurrentMonthCost(userId);
                    if (currentCost >= subscription.spendingLimit) {
                        return {
                            allowed: false,
                            message: 'You have reached your spending limit. Please increase your limit or wait for the next billing cycle.',
                            tokensRemaining: 0,
                            spendingLimit: subscription.spendingLimit,
                            tier: subscription.tier,
                        };
                    }
                }
                // Allow if no spending limit or not reached
                return {
                    allowed: true,
                    tokensRemaining: remaining,
                    spendingLimit: subscription.spendingLimit,
                    tier: subscription.tier,
                };
            }
        }

        return {
            allowed: true,
            tokensRemaining: remaining,
            spendingLimit: subscription.spendingLimit,
            tier: subscription.tier,
        };
    }

    async trackTokenUsage(userId: string, tokensUsed: number, teamId?: string, botId?: string, chatId?: string, operationType: string = 'chat', taskId?: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        // Pre-compute cost so the log row carries it. Stripe reporting + spending-limit
        // enforcement happen AFTER tracking so they don't leave the system in a state
        // where tokens were charged but never recorded (the previous version of this
        // function had that bug).
        let cost = 0;
        const baseAllocation = subscription.monthlyTokenAllocation;
        let overageTokens = 0;
        if (subscription.tier === 'PREMIUM' && subscription.tokensUsedThisMonth >= baseAllocation) {
            overageTokens = Math.min(tokensUsed, subscription.tokensUsedThisMonth + tokensUsed - baseAllocation);
            if (overageTokens > 0) {
                const tokenPrice = await this.getTokenPrice();
                cost = (overageTokens / 1000) * tokenPrice;
            }
        }

        // Atomic insert + counter increment. The TokenUsageLog has a unique index on
        // (taskId, operationType) — Postgres treats NULL as distinct so chat rows
        // (taskId=null) are unaffected, but ingestion duplicates from a second backend
        // pod hit P2002. On dup, the transaction rolls back and the subscription
        // counter is NOT incremented a second time.
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.tokenUsageLog.create({
                    data: {
                        subscriptionId: subscription.id,
                        teamId,
                        botId,
                        chatId,
                        taskId,
                        operationType,
                        tokensUsed,
                        cost,
                    },
                });
                await tx.subscription.update({
                    where: { userId },
                    data: {
                        tokensUsedThisMonth: { increment: tokensUsed },
                    },
                });
            });
        } catch (e: any) {
            if (e?.code === 'P2002' && taskId) {
                // Another replica already tracked this task. Silent skip — do not
                // increment counters, do not report to Stripe.
                console.log(`[trackTokenUsage] duplicate skipped taskId=${taskId} operationType=${operationType}`);
                return {
                    success: false,
                    duplicate: true,
                    tokensUsed: 0,
                    cost: 0,
                    tokensRemaining: subscription.monthlyTokenAllocation + subscription.additionalTokensPurchased - subscription.tokensUsedThisMonth,
                };
            }
            throw e;
        }

        // Spending-limit check + Stripe report run after the row is committed.
        if (overageTokens > 0 && cost > 0) {
            if (subscription.spendingLimit) {
                const currentMonthCost = await this.getCurrentMonthCost(userId);
                if (currentMonthCost + cost > subscription.spendingLimit) {
                    throw new BadRequestException('Spending limit exceeded. Please increase your limit or wait for the next billing cycle.');
                }
            }

            if (subscription.stripeSubscriptionId) {
                await this.reportUsageToStripe(subscription.stripeSubscriptionId, subscription.stripeCustomerId, overageTokens, cost);
            }
        }

        return {
            success: true,
            tokensUsed,
            cost,
            tokensRemaining: subscription.monthlyTokenAllocation + subscription.additionalTokensPurchased - (subscription.tokensUsedThisMonth + tokensUsed),
        };
    }

    private async reportUsageToStripe(subscriptionId: string, stripeCustomerId: string, tokensUsed: number, cost: number) {
        try {
            if (!stripeCustomerId) {
                console.error('No Stripe customer ID — skipping usage report.');
                return;
            }

            const eventName = this.stripeBootstrap.getTokenMeterEventName();
            const units = Math.ceil(tokensUsed / 1000);

            // Yeni Billing Meters API: usage_type: 'metered' yerine meterEvents kullanılır
            await (this.stripe.billing as any).meterEvents.create({
                event_name: eventName,
                payload: {
                    value: String(units),
                    stripe_customer_id: stripeCustomerId,
                },
                timestamp: Math.floor(Date.now() / 1000),
            });

            console.log(`✓ Reported ${tokensUsed} tokens (${units} units) to Stripe meter "${eventName}" for customer ${stripeCustomerId}`);
        } catch (error) {
            console.error('✗ Error reporting usage to Stripe:', error);
            // Don't throw - token usage is still logged locally in TokenUsageLog
        }
    }


    async resetMonthlyUsage(userId: string) {
        await this.prisma.subscription.update({
            where: { userId },
            data: {
                tokensUsedThisMonth: 0,
                additionalTokensPurchased: 0,
            },
        });
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

    private async getTokenPrice(): Promise<number> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: 'TOKEN_PRICE_PER_1K' },
        });
        return setting ? parseFloat(setting.value) : 0.01; // Default to config value
    }

    private async getCurrentMonthCost(userId: string): Promise<number> {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) return 0;

        const subscriptionWithLogs = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                tokenUsageLogs: {
                    where: {
                        createdAt: {
                            gte: subscription.currentPeriodStart,
                        },
                    },
                },
            },
        });

        return subscriptionWithLogs.tokenUsageLogs.reduce((sum, log) => sum + log.cost, 0);
    }

    private async getBasePriceId(billingInterval: 'monthly' | 'yearly'): Promise<string> {
        const planType = billingInterval === 'yearly' ? 'YEARLY_BASE' : 'MONTHLY_BASE';
        return this.pricePlanService.getActivePriceId(planType);
    }

    private async getMeteredPriceId(): Promise<string> {
        return this.pricePlanService.getActivePriceId('TOKEN_METERED');
    }

    async getPricingInfo() {
        try {
            const [monthlyPlan, yearlyPlan, tokenPlan] = await Promise.all([
                this.prisma.pricePlan.findFirst({ where: { status: 'ACTIVE', planType: 'MONTHLY_BASE' } }),
                this.prisma.pricePlan.findFirst({ where: { status: 'ACTIVE', planType: 'YEARLY_BASE' } }),
                this.prisma.pricePlan.findFirst({ where: { status: 'ACTIVE', planType: 'TOKEN_METERED' } }),
            ]);

            if (!monthlyPlan || !yearlyPlan) {
                throw new Error('Active price plans not configured');
            }

            return {
                monthly: {
                    priceId: monthlyPlan.stripePriceId,
                    amountUsd: monthlyPlan.amountUsd,
                },
                yearly: {
                    priceId: yearlyPlan.stripePriceId,
                    amountUsd: yearlyPlan.amountUsd,
                },
                token: tokenPlan ? {
                    priceId: tokenPlan.stripePriceId,
                    amountUsd: tokenPlan.amountUsd,
                } : null,
            };
        } catch (error) {
            console.error('Error fetching pricing info:', error);
            throw new Error('Failed to fetch pricing information');
        }
    }
}
