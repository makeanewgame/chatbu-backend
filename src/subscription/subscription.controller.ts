import { Controller, Post, Get, Body, UseGuards, Req, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscriptionService } from './subscription.service';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../authentication/utils/google.guard';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

// Maps the 2-letter billing country to the Stripe tax ID type it expects
// (see Stripe's `Customer Tax IDs` docs). Only covers the countries offered
// in the frontend's billing country selects.
const TAX_ID_TYPE_BY_COUNTRY: Record<string, Stripe.TaxIdCreateParams.Type> = {
    US: 'us_ein',
    GB: 'gb_vat',
    CA: 'ca_bn',
    DE: 'eu_vat',
    FR: 'eu_vat',
    IT: 'eu_vat',
    ES: 'eu_vat',
    NL: 'eu_vat',
    BE: 'eu_vat',
    AT: 'eu_vat',
    CH: 'ch_vat',
    SE: 'eu_vat',
    NO: 'no_vat',
    DK: 'eu_vat',
    FI: 'eu_vat',
    PL: 'eu_vat',
    TR: 'tr_tin',
    AU: 'au_abn',
    NZ: 'nz_gst',
    JP: 'jp_trn',
    KR: 'kr_brn',
    SG: 'sg_gst',
    IN: 'in_gst',
    BR: 'br_cnpj',
    MX: 'mx_rfc',
    AR: 'ar_cuit',
    CL: 'cl_tin',
};

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

    @Post('create-subscription')
    @UseGuards(JwtGuard)
    @Throttle({ default: { ttl: 60000, limit: 5 } }) // max 5 attempts per minute per user
    async createSubscription(@Req() req, @Body() body: { billingInfo: any; planDetails: any }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.createSubscription(userId, body.billingInfo, body.planDetails);
    }

    @Post('cancel')
    @UseGuards(JwtGuard)
    async cancel(@Req() req, @Body() body: { reasons?: string[]; otherText?: string }) {
        const userId = req.user?.sub || req.user?.id;
        return this.subscriptionService.cancelSubscription(userId, body?.reasons, body?.otherText);
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
        } catch (err: any) {
            throw new Error(`Webhook signature verification failed: ${err.message}`);
        }

        await this.billingService.handleWebhook(event);

        return { received: true };
    }

    @Post('billing-info')
    @UseGuards(JwtGuard)
    async saveBillingInfo(@Req() req, @Body() body: any) {
        const userId = req.user?.sub || req.user?.id;
        // Whitelist fields explicitly to prevent mass assignment
        const safeData = {
            firstName: body.firstName,
            lastName: body.lastName || '',
            email: body.email,
            address: body.address,
            city: body.city || '',
            stateRegion: body.stateRegion,
            zipPostalCode: body.zipPostalCode,
            country: body.country,
            isCompany: body.isCompany || false,
            vatIdentificationNumber: body.vatIdentificationNumber || null,
        };
        const billingInfo = await this.prisma.billingInfo.upsert({
            where: { userId },
            create: { userId, ...safeData },
            update: safeData,
        });

        // Keep the Stripe customer in sync so future invoices/receipts use
        // the updated name, email and address instead of the stale ones
        // captured when the subscription was first created.
        const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
        if (this.stripe && subscription?.stripeCustomerId) {
            await this.stripe.customers.update(subscription.stripeCustomerId, {
                name: `${safeData.firstName} ${safeData.lastName}`.trim(),
                email: safeData.email,
                address: {
                    line1: safeData.address,
                    city: safeData.city,
                    state: safeData.stateRegion,
                    postal_code: safeData.zipPostalCode,
                    country: safeData.country,
                },
            });

            try {
                await this.syncStripeTaxId(subscription.stripeCustomerId, safeData);
            } catch (err: any) {
                // Don't fail the whole save over a rejected tax ID (e.g. bad
                // checksum) — the name/email/address sync above already went
                // through, which is what fixes wrong invoice addresses.
                console.warn('Failed to sync Stripe tax ID:', err?.message);
            }
        }

        return billingInfo;
    }

    private async syncStripeTaxId(
        stripeCustomerId: string,
        safeData: { isCompany: boolean; vatIdentificationNumber: string | null; country: string },
    ) {
        const taxIdType = TAX_ID_TYPE_BY_COUNTRY[safeData.country];
        const shouldHaveTaxId = safeData.isCompany && !!safeData.vatIdentificationNumber && !!taxIdType;

        const existingTaxIds = await this.stripe.customers.listTaxIds(stripeCustomerId);
        const alreadyInSync = shouldHaveTaxId && existingTaxIds.data.some(
            (taxId) => taxId.type === taxIdType && taxId.value === safeData.vatIdentificationNumber,
        );
        if (alreadyInSync) {
            return;
        }

        for (const taxId of existingTaxIds.data) {
            await this.stripe.customers.deleteTaxId(stripeCustomerId, taxId.id);
        }

        if (shouldHaveTaxId) {
            await this.stripe.customers.createTaxId(stripeCustomerId, {
                type: taxIdType,
                value: safeData.vatIdentificationNumber,
            });
        }
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

    @Get('pricing')
    async getPricing() {
        return this.subscriptionService.getPricingInfo();
    }
}
