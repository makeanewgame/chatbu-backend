import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { PrismaService } from '../prisma/prisma.service';

const SUBSCRIPTION_LOOKUP_KEY = 'chatbu-premium-subscription';
const TOKEN_USAGE_LOOKUP_KEY = 'chatbu-token-usage';
const TOKEN_METER_EVENT_NAME = 'chatbu_token_usage';
const TOKEN_METER_SETTINGS_KEY = 'stripeTokenMeterId';

@Injectable()
export class StripeBootstrapService implements OnModuleInit {
    private readonly logger = new Logger(StripeBootstrapService.name);
    private stripe: Stripe;

    constructor(
        private prisma: PrismaService,
        private config: ConfigService,
    ) {
        const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
        if (stripeKey) {
            this.stripe = new Stripe(stripeKey);
        }
    }

    async onModuleInit() {
        if (!this.stripe) {
            this.logger.warn('Stripe key not configured — skipping bootstrap');
            return;
        }
        try {
            await this.ensureProducts();
            this.logger.log('Stripe bootstrap completed');
        } catch (err) {
            this.logger.error('Stripe bootstrap failed', err);
        }
    }

    private async ensureProducts() {
        await Promise.all([
            this.ensureProduct(
                SUBSCRIPTION_LOOKUP_KEY,
                'ChatBu Premium Subscription',
                'SUBSCRIPTION',
            ),
            this.ensureProduct(
                TOKEN_USAGE_LOOKUP_KEY,
                'ChatBu Token Usage',
                'TOKEN_USAGE',
            ),
            this.ensureMeter(),
        ]);
    }

    /**
     * Stripe Billing Meter'ı oluşturur veya mevcut olanı bulur.
     * Meter ID'si SystemSettings'e 'stripeTokenMeterId' key'i ile kaydedilir.
     */
    private async ensureMeter() {
        // DB'de var mı?
        const existing = await this.prisma.systemSettings.findUnique({
            where: { key: TOKEN_METER_SETTINGS_KEY },
        });

        if (existing) {
            try {
                await (this.stripe.billing as any).meters.retrieve(existing.value);
                this.logger.log(`Billing meter already exists: ${existing.value}`);
                return;
            } catch {
                this.logger.warn('Billing meter missing in Stripe, recreating');
                await this.prisma.systemSettings.delete({ where: { key: TOKEN_METER_SETTINGS_KEY } });
            }
        }

        // Stripe'ta aynı event_name ile meter ara
        const meters = await (this.stripe.billing as any).meters.list({ limit: 100 });
        const found = meters.data?.find((m: any) => m.event_name === TOKEN_METER_EVENT_NAME && m.status === 'active');

        let meterId: string;
        if (found) {
            meterId = found.id;
            this.logger.log(`Found existing Stripe billing meter: ${meterId}`);
        } else {
            const meter = await (this.stripe.billing as any).meters.create({
                display_name: 'ChatBu Token Usage',
                event_name: TOKEN_METER_EVENT_NAME,
                default_aggregation: { formula: 'sum' },
                customer_mapping: {
                    type: 'by_id',
                    event_payload_key: 'stripe_customer_id',
                },
                value_settings: { event_payload_key: 'value' },
            });
            meterId = meter.id;
            this.logger.log(`Created Stripe billing meter: ${meterId}`);
        }

        await this.prisma.systemSettings.upsert({
            where: { key: TOKEN_METER_SETTINGS_KEY },
            create: { key: TOKEN_METER_SETTINGS_KEY, value: meterId, description: 'Stripe Billing Meter ID for token usage' },
            update: { value: meterId },
        });
    }

    private async ensureProduct(
        lookupKey: string,
        name: string,
        productType: 'SUBSCRIPTION' | 'TOKEN_USAGE',
    ) {
        // 1. DB'de var mı kontrol et
        const existing = await this.prisma.stripeProduct.findUnique({
            where: { lookupKey },
        });

        if (existing) {
            // DB'de var — Stripe'ta da aktif mi doğrula
            let needsRecreate = false;
            try {
                const stripeProduct = await this.stripe.products.retrieve(existing.stripeProductId);
                if (stripeProduct.active) {
                    this.logger.log(`Product already exists: ${lookupKey}`);
                    return existing;
                }
                // Stripe'ta var ama archived (active: false) — yeniden oluştur
                this.logger.warn(`Product archived in Stripe, recreating: ${lookupKey}`);
                needsRecreate = true;
            } catch {
                // Stripe'tan kalıcı silinmiş (404)
                this.logger.warn(`Product missing in Stripe, recreating: ${lookupKey}`);
                needsRecreate = true;
            }

            if (needsRecreate) {
                // Sadece active product'ları ara — archived'ları atlat
                const stripeProductsSearch = await this.stripe.products.search({
                    query: `metadata['lookup_key']:'${lookupKey}' AND active:'true'`,
                    limit: 1,
                });

                let newStripeProductId: string;
                if (stripeProductsSearch.data.length > 0) {
                    newStripeProductId = stripeProductsSearch.data[0].id;
                    this.logger.log(`Found active Stripe product for ${lookupKey}: ${newStripeProductId}`);
                } else {
                    const product = await this.stripe.products.create({
                        name,
                        metadata: { lookup_key: lookupKey },
                    });
                    newStripeProductId = product.id;
                    this.logger.log(`Created new Stripe product: ${newStripeProductId} (${lookupKey})`);
                }

                const updated = await this.prisma.stripeProduct.update({
                    where: { lookupKey },
                    data: { stripeProductId: newStripeProductId },
                });
                this.logger.log(`Updated DB product ${lookupKey} → Stripe ID: ${newStripeProductId}`);
                return updated;
            }
        }

        // 2. Stripe'ta lookup_key ile ara — sadece active product'lar
        const stripeProducts = await this.stripe.products.search({
            query: `metadata['lookup_key']:'${lookupKey}' AND active:'true'`,
            limit: 1,
        });

        let stripeProductId: string;

        if (stripeProducts.data.length > 0) {
            stripeProductId = stripeProducts.data[0].id;
            this.logger.log(`Found existing Stripe product for ${lookupKey}: ${stripeProductId}`);
        } else {
            // 3. Yoksa oluştur
            const product = await this.stripe.products.create({
                name,
                metadata: { lookup_key: lookupKey },
            });
            stripeProductId = product.id;
            this.logger.log(`Created Stripe product: ${stripeProductId} (${lookupKey})`);
        }

        // 4. DB'ye kaydet
        const dbProduct = await this.prisma.stripeProduct.create({
            data: {
                productType,
                stripeProductId,
                lookupKey,
                name,
            },
        });

        return dbProduct;
    }

    /**
     * Dışarıdan çağrılabilir: her iki product'ın DB kaydını döner.
     * PricePlanService bunları kullanır.
     */
    async getProductByType(productType: 'SUBSCRIPTION' | 'TOKEN_USAGE') {
        return this.prisma.stripeProduct.findUnique({
            where: { productType },
        });
    }

    /** Stripe Billing Meter ID'sini döner (TOKEN_METERED fiyat oluşturulurken gerekli) */
    async getTokenMeterId(): Promise<string | null> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: TOKEN_METER_SETTINGS_KEY },
        });
        return setting?.value ?? null;
    }

    /** Meter event_name sabitini döner (usage raporlamada kullanılır) */
    getTokenMeterEventName(): string {
        return TOKEN_METER_EVENT_NAME;
    }
}
