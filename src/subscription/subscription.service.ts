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

        let subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                user: true,
                invoices: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!subscription) {
            // Create default FREE subscription
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
                    invoices: true,
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

    async trackTokenUsage(userId: string, teamId: string, tokensUsed: number) {
        const subscription = await this.getOrCreateSubscription(userId);
        const tokenPrice = await this.getTokenPrice();
        const cost = (tokensUsed / 1000) * tokenPrice;

        // Update subscription usage
        await this.prisma.subscription.update({
            where: { userId },
            data: {
                tokensUsedThisMonth: subscription.tokensUsedThisMonth + tokensUsed,
            },
        });

        // Log usage
        await this.prisma.tokenUsageLog.create({
            data: {
                subscriptionId: subscription.id,
                teamId,
                tokensUsed,
                cost,
            },
        });

        return { tokensUsed, cost };
    }

    async checkTokenQuota(userId: string): Promise<{ allowed: boolean; message?: string }> {
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
                };
            } else {
                // Premium user - check spending limit
                if (subscription.spendingLimit) {
                    const currentCost = await this.getCurrentMonthCost(userId);
                    if (currentCost >= subscription.spendingLimit) {
                        return {
                            allowed: false,
                            message: 'You have reached your spending limit. Please increase your limit or wait for the next billing cycle.',
                        };
                    }
                }
                // Allow if no spending limit or not reached
                return { allowed: true };
            }
        }

        return { allowed: true };
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
