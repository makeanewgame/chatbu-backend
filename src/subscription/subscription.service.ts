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

        // Use upsert to avoid race conditions
        const subscription = await this.prisma.subscription.upsert({
            where: { userId },
            create: {
                userId,
                tier: 'FREE',
                status: 'ACTIVE',
                monthlyTokenAllocation: await this.getFreeTokenLimit(),
                tokensUsedThisMonth: 0,
            },
            update: {},
            include: {
                user: true,
                invoices: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

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
            const customer = await this.stripe.customers.create({
                email: billingInfo.email || user.email,
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

        // Create Payment Intent for subscription
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(totalPrice * 100), // Convert to cents
            currency: currency,
            customer: stripeCustomerId,
            setup_future_usage: 'off_session',
            metadata: {
                userId: user.id,
                isAnnual: isAnnual.toString(),
                subscriptionType: 'premium',
            },
        });

        return {
            clientSecret: paymentIntent.client_secret,
            customerId: stripeCustomerId,
        };
    }

    async createCheckoutSession(userId: string, billingInfo: any, planDetails: any) {
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
            const customer = await this.stripe.customers.create({
                email: billingInfo.email || user.email,
                name: `${billingInfo.firstName} ${billingInfo.lastName}`,
                metadata: {
                    userId: user.id,
                },
                address: {
                    line1: billingInfo.billingAddress,
                    state: billingInfo.stateRegion,
                    postal_code: billingInfo.zipCode,
                    country: billingInfo.country,
                },
            });
            stripeCustomerId = customer.id;

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
                city: '',
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

        // Create or get Stripe price for the plan
        const price = await this.stripe.prices.create({
            unit_amount: Math.round(totalPrice * 100), // Convert to cents
            currency: currency,
            recurring: {
                interval: isAnnual ? 'year' : 'month'
            },
            product_data: {
                name: isAnnual ? 'Premium Subscription (Annual)' : 'Premium Subscription (Monthly)',
            },
        });

        // Create Stripe Checkout Session
        const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:5173';
        const session = await this.stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: price.id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/pricing?canceled=true`,
            metadata: {
                userId: user.id,
                isAnnual: isAnnual.toString(),
            },
        });

        return {
            sessionId: session.id,
            sessionUrl: session.url,
        };
    }

    async handleCheckoutSuccess(sessionId: string) {
        // Retrieve the checkout session
        const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription', 'customer'],
        });

        if (!session.metadata?.userId) {
            throw new BadRequestException('Invalid session metadata');
        }

        const userId = session.metadata.userId;
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        // Update subscription to PREMIUM
        // Get subscription from expanded session or retrieve it
        let stripeSubscription: Stripe.Subscription;
        if (typeof session.subscription === 'string') {
            stripeSubscription = await this.stripe.subscriptions.retrieve(session.subscription);
        } else {
            stripeSubscription = session.subscription as Stripe.Subscription;
        }

        // Debug: Log subscription object
        console.log('Stripe Subscription Object:', JSON.stringify(stripeSubscription, null, 2));

        // Get period from subscription items (Stripe stores it there)
        const subscriptionItem = (stripeSubscription as any).items?.data?.[0];
        const periodStart = subscriptionItem?.current_period_start;
        const periodEnd = subscriptionItem?.current_period_end;

        console.log('Period Start:', periodStart, 'Period End:', periodEnd);

        if (!periodStart || !periodEnd) {
            throw new BadRequestException('Invalid subscription period data');
        }

        const currentPeriodStart = new Date(periodStart * 1000);
        const currentPeriodEnd = new Date(periodEnd * 1000);

        await this.prisma.subscription.update({
            where: { userId },
            data: {
                tier: 'PREMIUM',
                status: 'ACTIVE',
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId: stripeSubscription.items.data[0].price.id,
                currentPeriodStart,
                currentPeriodEnd,
                monthlyTokenAllocation: await this.getPremiumTokenLimit(),
                tokensUsedThisMonth: 0,
            },
        });

        return {
            success: true,
            message: 'Subscription upgraded to Premium successfully',
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

        // Get customer's default payment method
        const paymentMethodId = paymentIntent.payment_method as string;

        // Set as default payment method
        await this.stripe.customers.update(paymentIntent.customer as string, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Determine currency and price
        const isAnnual = paymentIntent.metadata?.isAnnual === 'true';
        const currency = paymentIntent.currency;

        // Create Stripe Product and Price for subscription
        const product = await this.stripe.products.create({
            name: isAnnual ? 'Premium Subscription (Annual)' : 'Premium Subscription (Monthly)',
        });

        const price = await this.stripe.prices.create({
            product: product.id,
            unit_amount: paymentIntent.amount,
            currency: currency,
            recurring: {
                interval: isAnnual ? 'year' : 'month',
            },
        });

        // Create Stripe Subscription
        const stripeSubscription = await this.stripe.subscriptions.create({
            customer: paymentIntent.customer as string,
            items: [{ price: price.id }],
            default_payment_method: paymentMethodId,
            metadata: {
                userId: userId,
                isAnnual: isAnnual.toString(),
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
                stripePriceId: price.id,
                currentPeriodStart,
                currentPeriodEnd,
                monthlyTokenAllocation: await this.getPremiumTokenLimit(),
                tokensUsedThisMonth: 0,
            },
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

    async upgradeToPremium(userId: string, billingInfo: any) {
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
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${billingInfo.firstName} ${billingInfo.lastName}`,
                metadata: {
                    userId: user.id,
                },
                address: {
                    line1: billingInfo.address,
                    city: billingInfo.city,
                    state: billingInfo.stateRegion,
                    postal_code: billingInfo.zipPostalCode,
                    country: billingInfo.country,
                },
            });
            stripeCustomerId = customer.id;
        }

        // Get premium price from settings
        const premiumPrice = await this.getPremiumMonthlyPrice();

        // Create Stripe price if not exists
        let stripePriceId = await this.getOrCreateStripePriceId(premiumPrice);

        // Create Stripe subscription
        const stripeSubscription = await this.stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: [{ price: stripePriceId }],
            metadata: {
                userId: user.id,
            },
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
        });

        // Save billing info
        await this.prisma.billingInfo.upsert({
            where: { userId },
            create: {
                userId,
                ...billingInfo,
            },
            update: billingInfo,
        });

        // Update subscription
        const currentPeriodStart = (stripeSubscription as any).current_period_start
            ? new Date((stripeSubscription as any).current_period_start * 1000)
            : new Date();
        const currentPeriodEnd = (stripeSubscription as any).current_period_end
            ? new Date((stripeSubscription as any).current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const updatedSubscription = await this.prisma.subscription.update({
            where: { userId },
            data: {
                tier: 'PREMIUM',
                status: 'ACTIVE',
                stripeCustomerId,
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId,
                currentPeriodStart,
                currentPeriodEnd,
                monthlyTokenAllocation: await this.getPremiumTokenLimit(),
                tokensUsedThisMonth: 0,
            },
        });

        return {
            subscription: updatedSubscription,
            clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret,
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
            // Get subscription items to find the usage-based price
            const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);

            // Find or create usage-based price item
            let usageItem = stripeSubscription.items.data.find(item =>
                item.price.recurring?.usage_type === 'metered'
            );

            if (!usageItem) {
                // Create metered price if it doesn't exist
                const product = await this.stripe.products.create({
                    name: 'Additional Token Usage',
                });

                const meteredPrice = await this.stripe.prices.create({
                    product: product.id,
                    currency: stripeSubscription.currency || 'try',
                    recurring: {
                        interval: 'month',
                        usage_type: 'metered',
                    },
                    billing_scheme: 'per_unit',
                    unit_amount: Math.round(await this.getTokenPrice() * 100 / 1000), // Price per 1000 tokens in cents
                });

                // Add metered price to subscription
                usageItem = await this.stripe.subscriptionItems.create({
                    subscription: subscriptionId,
                    price: meteredPrice.id,
                });
            }

            // Report usage (in units of 1000 tokens)
            await (this.stripe.subscriptionItems as any).createUsageRecord(
                usageItem.id,
                {
                    quantity: Math.ceil(tokensUsed / 1000),
                    timestamp: Math.floor(Date.now() / 1000),
                    action: 'increment',
                }
            );

            console.log(`Reported ${tokensUsed} tokens (${Math.ceil(tokensUsed / 1000)} units) to Stripe for subscription ${subscriptionId}`);
        } catch (error) {
            console.error('Error reporting usage to Stripe:', error);
            // Don't throw - log usage locally even if Stripe fails
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
        return setting ? parseFloat(setting.value) : 0.002;
    }

    private async getPremiumMonthlyPrice(): Promise<number> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: 'PREMIUM_MONTHLY_PRICE' },
        });
        return setting ? parseFloat(setting.value) : 29.99;
    }

    private async getOrCreateStripePriceId(amount: number): Promise<string> {
        // In production, you should store this in database
        // For now, create a new price each time (or store in SystemSettings)
        const price = await this.stripe.prices.create({
            unit_amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            recurring: { interval: 'month' },
            product_data: {
                name: 'Premium Subscription',
            },
        });
        return price.id;
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
}
