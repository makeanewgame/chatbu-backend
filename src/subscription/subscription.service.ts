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
        }

        return {
            ...subscription,
            paymentMethod,
        };
    }

    async createPaymentIntent(userId: string, billingInfo: any, planDetails: any) {
        console.log('createPaymentItent called');
        const subscription = await this.getOrCreateSubscription(userId);
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (subscription.tier === 'PREMIUM') {
            throw new BadRequestException('Already a premium member');
        }

        // Create or get Stripe customer
        let stripeCustomerId = subscription.stripeCustomerId;
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

        // Determine currency and price
        const currency = planDetails.currency?.toLowerCase() || 'try';
        const totalPrice = planDetails.totalPrice || 899;
        const isAnnual = planDetails.isAnnual || false;
        const billingInterval = planDetails.billingInterval || (isAnnual ? 'yearly' : 'monthly');

        // Create Payment Intent for subscription (supports dynamic currency)
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(totalPrice * 100), // Convert to cents
            currency: currency,
            customer: stripeCustomerId,
            setup_future_usage: 'off_session',
            metadata: {
                userId: user.id,
                isAnnual: isAnnual.toString(),
                billingInterval: billingInterval,
                subscriptionType: 'premium',
            },
        });

        return {
            clientSecret: paymentIntent.client_secret,
            customerId: stripeCustomerId,
        };
    }

    async confirmPayment(userId: string, paymentIntentId: string) {
        // Retrieve payment intent
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            throw new BadRequestException('Payment not successful');
        }

        if (paymentIntent.metadata?.userId !== userId) {
            throw new BadRequestException('Invalid payment metadata');
        }

        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        // Check if already upgraded to prevent duplicate subscriptions
        if (subscription.tier === 'PREMIUM' && subscription.stripeSubscriptionId) {
            // Already upgraded, just return success
            return {
                success: true,
                message: 'Subscription already activated',
                subscription: {
                    tier: 'PREMIUM',
                    status: subscription.status,
                    currentPeriodStart: subscription.currentPeriodStart,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                },
            };
        }

        // Get customer's default payment method
        const paymentMethodId = paymentIntent.payment_method as string;

        // Set as default payment method
        await this.stripe.customers.update(paymentIntent.customer as string, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Get predefined price IDs - default to monthly
        const billingInterval = paymentIntent.metadata?.billingInterval as 'monthly' | 'yearly' || 'monthly';
        const basePriceId = await this.getBasePriceId(billingInterval);
        const meteredPriceId = await this.getMeteredPriceId();

        // Calculate billing cycle anchor (next period start)
        // User already paid for the first period via payment intent
        const now = Math.floor(Date.now() / 1000);
        const periodDuration = billingInterval === 'yearly' ? 365 * 24 * 60 * 60 : 30 * 24 * 60 * 60;
        const billingCycleAnchor = now + periodDuration;

        // Create Stripe Subscription with both base and metered prices
        // Setting billing_cycle_anchor to prevent immediate charge since user already paid
        const stripeSubscription = await this.stripe.subscriptions.create({
            customer: paymentIntent.customer as string,
            items: [
                { price: basePriceId },      // Base fee
                { price: meteredPriceId },   // Usage-based
            ],
            default_payment_method: paymentMethodId,
            billing_cycle_anchor: billingCycleAnchor,
            proration_behavior: 'none',
            metadata: {
                userId: userId,
                billingInterval: billingInterval,
                initialPaymentIntentId: paymentIntentId,
            },
        });

        const currentPeriodStart = (stripeSubscription as any).current_period_start
            ? new Date((stripeSubscription as any).current_period_start * 1000)
            : new Date();
        const currentPeriodEnd = (stripeSubscription as any).current_period_end
            ? new Date((stripeSubscription as any).current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Update subscription to PREMIUM
        const [activePlan, tokenPlan] = await Promise.all([
            this.prisma.pricePlan.findFirst({ where: { status: 'ACTIVE', planType: billingInterval === 'yearly' ? 'YEARLY_BASE' : 'MONTHLY_BASE' } }),
            this.prisma.pricePlan.findFirst({ where: { status: 'ACTIVE', planType: 'TOKEN_METERED' } }),
        ]);

        await this.prisma.subscription.update({
            where: { userId },
            data: {
                tier: 'PREMIUM',
                status: 'ACTIVE',
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId: basePriceId,
                currentPeriodStart,
                currentPeriodEnd,
                monthlyTokenAllocation: await this.getPremiumTokenLimit(),
                tokensUsedThisMonth: 0,
                billingInterval,
                activePricePlanId: activePlan?.id ?? null,
                tokenPricePlanId: tokenPlan?.id ?? null,
            },
        });

        //Update user Quota for PREMIUM
        // Update FILE, BOT

        const teamId = await this.prisma.teamMember.findFirst({
            where: { userId },
        }).then(member => member?.teamId);

        await this.prisma.quota.updateMany({
            where: {
                teamId: teamId,
                quotaType: 'FILE',
            },
            data: {
                limit: 256000, // 256MB for PREMIUM users
            },
        })

        await this.prisma.quota.updateMany({
            where: {
                teamId: teamId,
                quotaType: 'BOT',
            },
            data: {
                limit: 10, // 10 Bots for PREMIUM users
            },
        })


        await this.systemLogService.createLog({
            category: 'STRIPE',
            action: 'SUBSCRIBE',
            status: 'SUCCESS',
            userId,
            teamId,
            message: `Premium subscription activated`,
            details: { stripeSubscriptionId: stripeSubscription.id, billingInterval },
        });

        return {
            success: true,
            message: 'Subscription activated successfully',
            subscription: {
                tier: 'PREMIUM',
                status: 'ACTIVE',
                currentPeriodStart,
                currentPeriodEnd,
            },
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

            if (subscription.spendingLimit && subscription.stripeSubscriptionId) {
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
                    amountTry: monthlyPlan.amountTry,
                    exchangeRate: monthlyPlan.exchangeRate,
                },
                yearly: {
                    priceId: yearlyPlan.stripePriceId,
                    amountUsd: yearlyPlan.amountUsd,
                    amountTry: yearlyPlan.amountTry,
                    exchangeRate: yearlyPlan.exchangeRate,
                },
                token: tokenPlan ? {
                    priceId: tokenPlan.stripePriceId,
                    amountUsd: tokenPlan.amountUsd,
                    amountTry: tokenPlan.amountTry,
                } : null,
            };
        } catch (error) {
            console.error('Error fetching pricing info:', error);
            throw new Error('Failed to fetch pricing information');
        }
    }
}
