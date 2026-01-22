import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionService {
    private stripe: Stripe;

    constructor(
        private prisma: PrismaService,
        private config: ConfigService,
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
        const basePriceId = this.getBasePriceId(billingInterval);
        const meteredPriceId = this.getMeteredPriceId(billingInterval);

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

    async trackTokenUsage(userId: string, tokensUsed: number, teamId?: string, botId?: string, chatId?: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        // Update tokens used
        await this.prisma.subscription.update({
            where: { userId },
            data: {
                tokensUsedThisMonth: subscription.tokensUsedThisMonth + tokensUsed,
            },
        });

        // Calculate cost for overage (if PREMIUM and exceeded base allocation)
        let cost = 0;
        const baseAllocation = subscription.monthlyTokenAllocation;

        if (subscription.tier === 'PREMIUM' && subscription.tokensUsedThisMonth >= baseAllocation) {
            // Only charge for tokens beyond the base allocation
            const overageTokens = Math.min(tokensUsed, subscription.tokensUsedThisMonth + tokensUsed - baseAllocation);
            if (overageTokens > 0) {
                const tokenPrice = await this.getTokenPrice();
                cost = (overageTokens / 1000) * tokenPrice;

                // Check spending limit
                if (subscription.spendingLimit) {
                    const currentMonthCost = await this.getCurrentMonthCost(userId);
                    if (currentMonthCost + cost > subscription.spendingLimit) {
                        throw new BadRequestException('Spending limit exceeded. Please increase your limit or wait for the next billing cycle.');
                    }
                }

                // Report usage to Stripe if there's overage and spending limit is set
                if (subscription.spendingLimit && subscription.stripeSubscriptionId) {
                    await this.reportUsageToStripe(subscription.stripeSubscriptionId, overageTokens, cost);
                }
            }
        }

        // Log token usage
        await this.prisma.tokenUsageLog.create({
            data: {
                subscriptionId: subscription.id,
                teamId,
                botId,
                chatId,
                tokensUsed,
                cost,
            },
        });

        return {
            success: true,
            tokensUsed,
            cost,
            tokensRemaining: subscription.monthlyTokenAllocation + subscription.additionalTokensPurchased - (subscription.tokensUsedThisMonth + tokensUsed),
        };
    }

    private async reportUsageToStripe(subscriptionId: string, tokensUsed: number, cost: number) {
        try {
            const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
                expand: ['items.data.price']
            });

            // Find the metered price item (should already exist from subscription creation)
            // Check both monthly and yearly metered price IDs
            const monthlyMeteredPriceId = this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_MONTHLY_METERED');
            const yearlyMeteredPriceId = this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_YEARLY_METERED');
            const usageItem = stripeSubscription.items.data.find(item =>
                item.price.id === monthlyMeteredPriceId ||
                item.price.id === yearlyMeteredPriceId ||
                item.price.recurring?.usage_type === 'metered'
            );

            if (!usageItem) {
                // This shouldn't happen if subscription was created correctly
                console.error('Metered price item not found in subscription. Skipping usage report.');
                return;
            }

            // Report usage (in units of 1000 tokens as defined in Stripe price)
            await (this.stripe.subscriptionItems as any).createUsageRecord(
                usageItem.id,
                {
                    quantity: Math.ceil(tokensUsed / 1000),
                    timestamp: Math.floor(Date.now() / 1000),
                    action: 'increment',
                }
            );

            console.log(`✓ Reported ${tokensUsed} tokens (${Math.ceil(tokensUsed / 1000)} units) to Stripe for subscription ${subscriptionId}`);
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

    private getBasePriceId(billingInterval: 'monthly' | 'yearly'): string {
        const priceId = billingInterval === 'yearly'
            ? this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_YEARLY')
            : this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_MONTHLY');

        if (!priceId) {
            throw new Error(`Stripe ${billingInterval} base price ID not configured. Please set STRIPE_PREMIUM_BASE_PRICE_ID_${billingInterval.toUpperCase()} in .env`);
        }

        return priceId;
    }

    private getMeteredPriceId(billingInterval: 'monthly' | 'yearly'): string {
        const priceId = billingInterval === 'yearly'
            ? this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_YEARLY_METERED')
            : this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_MONTHLY_METERED');

        if (!priceId) {
            throw new Error(`Stripe ${billingInterval} metered price ID not configured. Please set STRIPE_PREMIUM_BASE_PRICE_ID_${billingInterval.toUpperCase()}_METERED in .env`);
        }

        return priceId;
    }

    async getPricingInfo() {
        try {
            const monthlyBasePriceId = this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_MONTHLY');
            const yearlyBasePriceId = this.config.get('STRIPE_PREMIUM_BASE_PRICE_ID_YEARLY');

            if (!monthlyBasePriceId || !yearlyBasePriceId) {
                throw new Error('Stripe price IDs not configured');
            }

            // Fetch price details from Stripe
            const [monthlyPrice, yearlyPrice] = await Promise.all([
                this.stripe.prices.retrieve(monthlyBasePriceId, { expand: ['currency_options'] }),
                this.stripe.prices.retrieve(yearlyBasePriceId, { expand: ['currency_options'] }),
            ]);

            return {
                monthly: {
                    priceId: monthlyPrice.id,
                    amount: monthlyPrice.unit_amount,
                    currency: monthlyPrice.currency,
                    currencyOptions: monthlyPrice.currency_options || {},
                },
                yearly: {
                    priceId: yearlyPrice.id,
                    amount: yearlyPrice.unit_amount,
                    currency: yearlyPrice.currency,
                    currencyOptions: yearlyPrice.currency_options || {},
                },
            };
        } catch (error) {
            console.error('Error fetching pricing info from Stripe:', error);
            throw new Error('Failed to fetch pricing information');
        }
    }
}
