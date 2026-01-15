import { Controller, Post, Get, Body, UseGuards, Req, Headers } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../authentication/utils/google.guard';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Controller('subscription')
export class SubscriptionController {
    private stripe: Stripe;

    constructor(
        private subscriptionService: SubscriptionService,
        private billingService: BillingService,
        private prisma: PrismaService,
        private config: ConfigService,
    ) {
        const stripeKey = this.config.get('STRIPE_SECRET_KEY');
        if (stripeKey) {
            this.stripe = new Stripe(stripeKey);
        }
    }

    @Get()
    @UseGuards(JwtGuard)
    async getSubscription(@Req() req) {
        const userId = req.user?.sub || req.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        return this.subscriptionService.getOrCreateSubscription(userId);
    }

    @Post('upgrade')
    @UseGuards(JwtGuard)
    async upgrade(@Req() req, @Body() billingInfo: any) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.upgradeToPremium(userId, billingInfo);
    }

    @Post('create-checkout-session')
    @UseGuards(JwtGuard)
    async createCheckoutSession(@Req() req, @Body() body: { billingInfo: any; planDetails: any }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.createCheckoutSession(userId, body.billingInfo, body.planDetails);
    }

    @Post('create-payment-intent')
    @UseGuards(JwtGuard)
    async createPaymentIntent(@Req() req, @Body() body: { billingInfo: any; planDetails: any }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.createPaymentIntent(userId, body.billingInfo, body.planDetails);
    }

    @Post('confirm-payment')
    @UseGuards(JwtGuard)
    async confirmPayment(@Req() req, @Body() body: { paymentIntentId: string }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.confirmPayment(userId, body.paymentIntentId);
    }

    @Post('checkout-success')
    @UseGuards(JwtGuard)
    async handleCheckoutSuccess(@Req() req, @Body() body: { sessionId: string }) {
        return this.subscriptionService.handleCheckoutSuccess(body.sessionId);
    }

    @Post('cancel')
    @UseGuards(JwtGuard)
    async cancel(@Req() req) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.cancelSubscription(userId);
    }

    @Post('purchase-tokens')
    @UseGuards(JwtGuard)
    async purchaseTokens(@Req() req, @Body() body: { tokenAmount: number }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.purchaseTokens(userId, body.tokenAmount);
    }

    @Post('set-spending-limit')
    @UseGuards(JwtGuard)
    async setSpendingLimit(@Req() req, @Body() body: { spendingLimit: number }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.setSpendingLimit(userId, body.spendingLimit);
    }

    @Post('update-payment-method')
    @UseGuards(JwtGuard)
    async updatePaymentMethod(@Req() req, @Body() body: { paymentMethodId: string }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.updatePaymentMethod(userId, body.paymentMethodId);
    }

    @Post('create-setup-intent')
    @UseGuards(JwtGuard)
    async createSetupIntent(@Req() req) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.createSetupIntent(userId);
    }

    @Get('check-quota')
    @UseGuards(JwtGuard)
    async checkQuota(@Req() req) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.checkTokenQuota(userId);
    }

    @Post('track-usage')
    @UseGuards(JwtGuard)
    async trackUsage(@Req() req, @Body() body: { tokensUsed: number; teamId?: string; botId?: string; chatId?: string }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.trackTokenUsage(userId, body.tokensUsed, body.teamId, body.botId, body.chatId);
    }

    @Post('webhook')
    async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: any) {
        const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET');

        if (!signature) {
            throw new Error('Missing stripe-signature header');
        }

        let event: Stripe.Event;

        try {
            // When using bodyParser.raw(), the body is a Buffer
            const payload = req.body instanceof Buffer ? req.body : Buffer.from(req.body);

            event = this.stripe.webhooks.constructEvent(
                payload,
                signature,
                webhookSecret,
            );
        } catch (err) {
            throw new Error(`Webhook signature verification failed: ${err.message}`);
        }

        await this.billingService.handleWebhook(event);

        return { received: true };
    }

    @Post('billing-info')
    @UseGuards(JwtGuard)
    async saveBillingInfo(@Req() req, @Body() billingInfo: any) {
        const userId = req.user?.sub || req.user?.id;
        return this.prisma.billingInfo.upsert({
            where: { userId },
            create: {
                userId,
                ...billingInfo,
            },
            update: billingInfo,
        });
    }

    @Get('billing-info')
    @UseGuards(JwtGuard)
    async getBillingInfo(@Req() req) {
        const userId = req.user?.sub || req.user?.id;
        return this.prisma.billingInfo.findUnique({
            where: { userId },
        });
    }

    @Get('invoices')
    @UseGuards(JwtGuard)
    async getInvoices(@Req() req) {
        const userId = req.user?.sub || req.user?.id;
        return this.billingService.getUserInvoices(userId);
    }
}
