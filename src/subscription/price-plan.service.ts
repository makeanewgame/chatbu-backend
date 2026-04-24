import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from './exchange-rate.service';
import { StripeBootstrapService } from './stripe-bootstrap.service';
import { CreatePricePlanDto, PublishPricePlanDto } from './dto/price-plan.dto';

const CONFIRMATION_TEXT = 'ONAYLA';

@Injectable()
export class PricePlanService {
    private readonly logger = new Logger(PricePlanService.name);
    private stripe: Stripe;

    constructor(
        private prisma: PrismaService,
        private config: ConfigService,
        private exchangeRate: ExchangeRateService,
        private stripeBootstrap: StripeBootstrapService,
    ) {
        const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
        if (stripeKey) {
            this.stripe = new Stripe(stripeKey);
        }
    }

    // ─── DRAFT OLUŞTUR ──────────────────────────────────────────────────────

    async createDraftPricePlan(dto: CreatePricePlanDto, adminId: string) {
        const { amountTry: monthlyTry, rate } = await this.exchangeRate.convertUsdToTry(dto.monthlyBaseUsd);
        const { amountTry: yearlyTry } = await this.exchangeRate.convertUsdToTry(dto.yearlyBaseUsd);
        const { amountTry: tokenTry } = await this.exchangeRate.convertUsdToTry(dto.tokenPer1000Usd);

        const subscriptionProduct = await this.stripeBootstrap.getProductByType('SUBSCRIPTION');
        const tokenProduct = await this.stripeBootstrap.getProductByType('TOKEN_USAGE');

        if (!subscriptionProduct || !tokenProduct) {
            throw new BadRequestException('Stripe products not initialized. Bootstrap may have failed.');
        }

        // 3 ayrı draft plan (monthly, yearly, token_metered) — grup olarak oluşturulur
        const timestamp = Date.now();

        const [monthly, yearly, token] = await this.prisma.$transaction([
            this.prisma.pricePlan.create({
                data: {
                    stripeProductId: subscriptionProduct.id,
                    planType: 'MONTHLY_BASE',
                    amountUsd: dto.monthlyBaseUsd,
                    amountTry: monthlyTry,
                    exchangeRate: rate,
                    status: 'DRAFT',
                    createdByAdminId: adminId,
                    lookupKey: `monthly_base_${timestamp}`,
                },
            }),
            this.prisma.pricePlan.create({
                data: {
                    stripeProductId: subscriptionProduct.id,
                    planType: 'YEARLY_BASE',
                    amountUsd: dto.yearlyBaseUsd,
                    amountTry: yearlyTry,
                    exchangeRate: rate,
                    status: 'DRAFT',
                    createdByAdminId: adminId,
                    lookupKey: `yearly_base_${timestamp}`,
                },
            }),
            this.prisma.pricePlan.create({
                data: {
                    stripeProductId: tokenProduct.id,
                    planType: 'TOKEN_METERED',
                    amountUsd: dto.tokenPer1000Usd,
                    amountTry: tokenTry,
                    exchangeRate: rate,
                    status: 'DRAFT',
                    createdByAdminId: adminId,
                    lookupKey: `token_metered_${timestamp}`,
                },
            }),
        ]);

        return { monthly, yearly, token, exchangeRate: rate };
    }

    // ─── YAYINA AL ──────────────────────────────────────────────────────────

    /**
     * groupTimestamp: createDraftPricePlan'dan dönen lookupKey'deki timestamp.
     * Üç draft planı birlikte yayına alır.
     * publishDto.confirmationText === "ONAYLA" zorunlu.
     */
    async publishPricePlans(monthlyDraftId: string, yearlyDraftId: string, tokenDraftId: string, dto: PublishPricePlanDto) {
        if (dto.confirmationText !== CONFIRMATION_TEXT) {
            throw new BadRequestException(`Confirmation text must be "${CONFIRMATION_TEXT}"`);
        }

        const [monthlyDraft, yearlyDraft, tokenDraft] = await Promise.all([
            this.prisma.pricePlan.findUnique({ where: { id: monthlyDraftId } }),
            this.prisma.pricePlan.findUnique({ where: { id: yearlyDraftId } }),
            this.prisma.pricePlan.findUnique({ where: { id: tokenDraftId } }),
        ]);

        if (!monthlyDraft || !yearlyDraft || !tokenDraft) {
            throw new NotFoundException('One or more draft plans not found');
        }
        if (monthlyDraft.status !== 'DRAFT' || yearlyDraft.status !== 'DRAFT' || tokenDraft.status !== 'DRAFT') {
            throw new BadRequestException('Plans must be in DRAFT status to publish');
        }

        // 0. Meter varlığını önceden doğrula — kısmi hata riski olmadan
        const meterId = await this.stripeBootstrap.getTokenMeterId();
        if (!meterId) {
            throw new BadRequestException('Stripe Billing Meter not initialized. Restart the server to trigger bootstrap.');
        }

        // 1. Stripe'ta yeni fiyatlar oluştur (sıralı: hata olursa sonrakiler yaratılmaz)
        const createdPriceIds: string[] = [];
        let stripeMonthly: Stripe.Price;
        let stripeYearly: Stripe.Price;
        let stripeToken: Stripe.Price;

        try {
            stripeMonthly = await this.createStripePrice(monthlyDraft, 'month', false, meterId);
            createdPriceIds.push(stripeMonthly.id);

            stripeYearly = await this.createStripePrice(yearlyDraft, 'year', false, meterId);
            createdPriceIds.push(stripeYearly.id);

            stripeToken = await this.createStripePrice(tokenDraft, 'month', true, meterId);
            createdPriceIds.push(stripeToken.id);
        } catch (err) {
            // Kısmi oluşturma — Stripe'ta yaratılanları inactive yap ve fırlat
            if (createdPriceIds.length > 0) {
                this.logger.warn(`Rolling back ${createdPriceIds.length} Stripe price(s) due to error: ${err.message}`);
                await Promise.all(
                    createdPriceIds.map((id) =>
                        this.stripe.prices.update(id, { active: false }).catch((e) =>
                            this.logger.warn(`Could not deactivate orphan price ${id}: ${e.message}`),
                        ),
                    ),
                );
            }
            throw err;
        }

        // 2. Stripe'ta eski aktif fiyatları archive et
        await this.archiveOldStripePrices();

        const now = new Date();

        // 3. DB'de eski aktif planları archive'a al, yeni planları aktif yap
        await this.prisma.$transaction(async (tx) => {
            // Eski aktifler → ARCHIVED
            await tx.pricePlan.updateMany({
                where: { status: 'ACTIVE' },
                data: { status: 'ARCHIVED', archivedAt: now },
            });

            // Yeni planlar → ACTIVE
            await tx.pricePlan.update({
                where: { id: monthlyDraftId },
                data: { status: 'ACTIVE', activatedAt: now, stripePriceId: stripeMonthly.id },
            });
            await tx.pricePlan.update({
                where: { id: yearlyDraftId },
                data: { status: 'ACTIVE', activatedAt: now, stripePriceId: stripeYearly.id },
            });
            await tx.pricePlan.update({
                where: { id: tokenDraftId },
                data: { status: 'ACTIVE', activatedAt: now, stripePriceId: stripeToken.id },
            });

            // Tüm aktif PREMIUM abonelere scheduled geçiş atanır
            const activeSubscriptions = await tx.subscription.findMany({
                where: { tier: 'PREMIUM', status: 'ACTIVE' },
                select: { id: true, billingInterval: true },
            });

            for (const sub of activeSubscriptions) {
                const newBasePlanId = sub.billingInterval === 'yearly' ? yearlyDraftId : monthlyDraftId;
                await tx.subscription.update({
                    where: { id: sub.id },
                    data: {
                        scheduledPricePlanId: newBasePlanId,
                        scheduledTokenPlanId: tokenDraftId,
                    },
                });
            }
        });

        this.logger.log(`Published new price plans: monthly=${monthlyDraftId}, yearly=${yearlyDraftId}, token=${tokenDraftId}`);

        return {
            message: 'Price plans published successfully. Subscribers will migrate at their next billing cycle.',
            monthly: stripeMonthly.id,
            yearly: stripeYearly.id,
            token: stripeToken.id,
        };
    }

    private async createStripePrice(plan: any, interval: 'month' | 'year', isMetered: boolean, meterId?: string): Promise<Stripe.Price> {
        const subscriptionProduct = await this.prisma.stripeProduct.findUnique({
            where: { id: plan.stripeProductId },
        });

        let recurringParams: Stripe.PriceCreateParams['recurring'];

        if (isMetered) {
            const resolvedMeterId = meterId ?? await this.stripeBootstrap.getTokenMeterId();
            if (!resolvedMeterId) {
                throw new BadRequestException('Stripe Billing Meter not initialized. Restart the server to trigger bootstrap.');
            }
            recurringParams = {
                interval,
                meter: resolvedMeterId,
                usage_type: 'metered',
            };
        } else {
            recurringParams = {
                interval,
                usage_type: 'licensed',
            };
        }

        const priceData: Stripe.PriceCreateParams = {
            product: subscriptionProduct.stripeProductId,
            currency: 'usd',
            unit_amount: Math.round(plan.amountUsd * 100),
            billing_scheme: 'per_unit',
            recurring: recurringParams,
            ...(!isMetered && {
                currency_options: {
                    try: {
                        unit_amount: Math.round(plan.amountTry * 100),
                    },
                },
            }),
            lookup_key: plan.lookupKey,
            transfer_lookup_key: true,
            metadata: {
                plan_type: plan.planType,
                db_plan_id: plan.id,
                ...(isMetered && { unit_label: '1000 tokens', amount_usd: String(plan.amountUsd) }),
            },
        };

        return this.stripe.prices.create(priceData);
    }

    private async archiveOldStripePrices() {
        const activePlans = await this.prisma.pricePlan.findMany({
            where: { status: 'ACTIVE', stripePriceId: { not: null } },
            select: { stripePriceId: true },
        });

        await Promise.all(
            activePlans.map((p) =>
                this.stripe.prices.update(p.stripePriceId, { active: false }).catch((err) =>
                    this.logger.warn(`Could not archive price ${p.stripePriceId}: ${err.message}`),
                ),
            ),
        );
    }

    // ─── LİSTELE ────────────────────────────────────────────────────────────

    async listPricePlans() {
        const plans = await this.prisma.pricePlan.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                stripeProduct: { select: { productType: true, name: true, stripeProductId: true } },
            },
        });

        if (!this.stripe) {
            return plans.map((p) => ({ ...p, stripeStatus: 'no_stripe' }));
        }

        // Stripe'ta her plan için fiyat/ürün doğrulaması (paralel, hata tolere edilir)
        const enriched = await Promise.all(
            plans.map(async (plan) => {
                if (!plan.stripePriceId) {
                    return { ...plan, stripeStatus: 'draft' };
                }
                try {
                    const price = await this.stripe.prices.retrieve(plan.stripePriceId);
                    const productMatch = price.product === plan.stripeProduct?.stripeProductId;
                    if (!productMatch) return { ...plan, stripeStatus: 'product_replaced' };
                    if (!price.active) return { ...plan, stripeStatus: 'price_archived' };
                    return { ...plan, stripeStatus: 'valid' };
                } catch {
                    return { ...plan, stripeStatus: 'price_not_found' };
                }
            }),
        );

        return enriched;
    }

    async getActivePlans() {
        return this.prisma.pricePlan.findMany({
            where: { status: 'ACTIVE' },
            include: {
                stripeProduct: { select: { productType: true } },
            },
        });
    }

    // ─── İSTATİSTİK ─────────────────────────────────────────────────────────

    async getPlanStats() {
        const activePlans = await this.prisma.pricePlan.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, planType: true, amountUsd: true, amountTry: true },
        });

        const stats = await Promise.all(
            activePlans.map(async (plan) => {
                const [current, scheduled] = await Promise.all([
                    this.prisma.subscription.count({
                        where: {
                            OR: [
                                { activePricePlanId: plan.id },
                                { tokenPricePlanId: plan.id },
                            ],
                            tier: 'PREMIUM',
                        },
                    }),
                    this.prisma.subscription.count({
                        where: {
                            OR: [
                                { scheduledPricePlanId: plan.id },
                                { scheduledTokenPlanId: plan.id },
                            ],
                        },
                    }),
                ]);
                return { ...plan, currentSubscribers: current, pendingMigration: scheduled };
            }),
        );

        return stats;
    }

    // ─── DRAFT SİL ──────────────────────────────────────────────────────────

    async deleteDraftPricePlan(id: string) {
        const plan = await this.prisma.pricePlan.findUnique({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');
        if (plan.status !== 'DRAFT') {
            throw new BadRequestException('Only DRAFT plans can be deleted');
        }
        await this.prisma.pricePlan.delete({ where: { id } });
        return { message: 'Draft plan deleted' };
    }

    // ─── STRIPE SENKRONIZASYON ───────────────────────────────────────────────

    /**
     * Stripe'ta fiyatı olmayan ACTIVE planlar için yeni Stripe fiyatları oluşturur.
     * Ürün yeniden bootstrap edildiğinde (arşivlenen ürün→yeni ürün) fiyatlar kaybolur;
     * bu endpoint onları yeniden senkronize eder.
     */
    async syncStripeToActive() {
        if (!this.stripe) {
            throw new BadRequestException('Stripe not configured');
        }

        const meterId = await this.stripeBootstrap.getTokenMeterId();
        if (!meterId) {
            throw new BadRequestException('Stripe Billing Meter not initialized. Restart the server.');
        }

        const activePlans = await this.prisma.pricePlan.findMany({
            where: { status: 'ACTIVE' },
            include: { stripeProduct: { select: { stripeProductId: true } } },
        });

        if (activePlans.length === 0) {
            throw new BadRequestException('No active plans found to sync');
        }

        const results: { planType: string; action: string; stripePriceId?: string; error?: string }[] = [];
        const createdPriceIds: string[] = [];

        try {
            for (const plan of activePlans) {
                // Mevcut stripePriceId kontrolü — Stripe'ta hâlâ geçerli mi?
                if (plan.stripePriceId) {
                    try {
                        const existing = await this.stripe.prices.retrieve(plan.stripePriceId);
                        const productMatch = existing.product === plan.stripeProduct?.stripeProductId;
                        if (existing.active && productMatch) {
                            results.push({ planType: plan.planType, action: 'skipped_valid', stripePriceId: plan.stripePriceId });
                            continue;
                        }
                    } catch {
                        // Price not found on Stripe — create a new one
                    }
                }

                // Yeni Stripe fiyatı oluştur
                const isMetered = plan.planType === 'TOKEN_METERED';
                const interval: 'month' | 'year' = plan.planType === 'YEARLY_BASE' ? 'year' : 'month';
                const newPrice = await this.createStripePrice(plan, interval, isMetered, meterId);
                createdPriceIds.push(newPrice.id);

                await this.prisma.pricePlan.update({
                    where: { id: plan.id },
                    data: { stripePriceId: newPrice.id },
                });

                results.push({ planType: plan.planType, action: 'created', stripePriceId: newPrice.id });
            }
        } catch (err) {
            // Kısmi oluşturma rollback
            if (createdPriceIds.length > 0) {
                this.logger.warn(`Sync rollback: deactivating ${createdPriceIds.length} prices`);
                await Promise.all(
                    createdPriceIds.map((id) =>
                        this.stripe.prices.update(id, { active: false }).catch((e) =>
                            this.logger.warn(`Could not deactivate ${id}: ${e.message}`),
                        ),
                    ),
                );
            }
            throw err;
        }

        this.logger.log(`Stripe sync complete: ${JSON.stringify(results)}`);
        return { message: 'Stripe sync complete', results };
    }

    // ─── PUBLIC: Fiyat ID'leri al (SubscriptionService için) ────────────────

    async getActivePriceId(planType: 'MONTHLY_BASE' | 'YEARLY_BASE' | 'TOKEN_METERED'): Promise<string> {
        const plan = await this.prisma.pricePlan.findFirst({
            where: { status: 'ACTIVE', planType },
        });
        if (!plan?.stripePriceId) {
            throw new Error(`No active Stripe price for plan type: ${planType}`);
        }
        return plan.stripePriceId;
    }
}
