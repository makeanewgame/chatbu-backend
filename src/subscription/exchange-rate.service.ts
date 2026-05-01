import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { parseStringPromise } from 'xml2js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
const SYSTEM_SETTINGS_KEY = 'lastKnownUsdTryRate';
const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

@Injectable()
export class ExchangeRateService {
    private readonly logger = new Logger(ExchangeRateService.name);
    private cachedRate: number | null = null;
    private cacheTimestamp: number | null = null;

    constructor(
        private httpService: HttpService,
        private prisma: PrismaService,
    ) { }

    /**
     * Güncel USD/TRY kuru döner.
     * Önce in-memory cache kontrol edilir (24h TTL).
     * Cache geçerliyse direkt döner. Değilse TCMB'den çeker.
     * TCMB erişilemezse DB'deki son bilinen kuru kullanır.
     */
    async getCurrentRate(): Promise<number> {
        if (this.isCacheValid()) {
            return this.cachedRate;
        }
        try {
            const rate = await this.fetchFromTcmb();
            this.updateCache(rate);
            await this.saveToDb(rate);
            return rate;
        } catch (err: any) {
            this.logger.warn(`TCMB fetch failed, using fallback: ${err.message}`);
            return this.getFallbackRate();
        }
    }

    /**
     * USD tutarı verilince TRY karşılığını ve kullanılan kuru döner.
     */
    async convertUsdToTry(amountUsd: number): Promise<{ amountTry: number; rate: number }> {
        const rate = await this.getCurrentRate();
        return {
            amountTry: parseFloat((amountUsd * rate).toFixed(2)),
            rate,
        };
    }

    private isCacheValid(): boolean {
        return (
            this.cachedRate !== null &&
            this.cacheTimestamp !== null &&
            Date.now() - this.cacheTimestamp < CACHE_TTL_MS
        );
    }

    private updateCache(rate: number) {
        this.cachedRate = rate;
        this.cacheTimestamp = Date.now();
    }

    private async fetchFromTcmb(): Promise<number> {
        const response = await firstValueFrom(
            this.httpService.get(TCMB_URL, {
                timeout: 8000,
                responseType: 'text',
            }),
        );

        const parsed = await parseStringPromise(response.data, { explicitArray: false });

        // TCMB XML yapısı: Tarih_Date.Currency[]
        const currencies: any[] = Array.isArray(parsed?.Tarih_Date?.Currency)
            ? parsed.Tarih_Date.Currency
            : [parsed?.Tarih_Date?.Currency];

        const usd = currencies.find(
            (c: any) => c?.$.CurrencyCode === 'USD',
        );

        if (!usd) {
            throw new Error('USD not found in TCMB response');
        }

        // ForexSelling: ticari işlemlerde kullanılan resmi satış kuru
        const rate = parseFloat(usd.ForexSelling);
        if (isNaN(rate) || rate <= 0) {
            throw new Error(`Invalid rate from TCMB: ${usd.ForexSelling}`);
        }

        this.logger.log(`TCMB USD/TRY rate: ${rate}`);
        return rate;
    }

    private async saveToDb(rate: number) {
        try {
            await this.prisma.systemSettings.upsert({
                where: { key: SYSTEM_SETTINGS_KEY },
                create: {
                    key: SYSTEM_SETTINGS_KEY,
                    value: rate.toString(),
                    description: 'Last known USD/TRY exchange rate from TCMB (ForexSelling)',
                },
                update: { value: rate.toString() },
            });
        } catch (err: any) {
            this.logger.warn(`Could not save rate to DB: ${err.message}`);
        }
    }

    private async getFallbackRate(): Promise<number> {
        // In-memory'de eski değer var mı?
        if (this.cachedRate !== null) {
            this.logger.log(`Using in-memory cached rate: ${this.cachedRate}`);
            return this.cachedRate;
        }
        // DB'den son bilinen kuru çek
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: SYSTEM_SETTINGS_KEY },
        });
        if (setting) {
            const rate = parseFloat(setting.value);
            this.logger.log(`Using DB fallback rate: ${rate}`);
            this.updateCache(rate);
            return rate;
        }
        throw new Error('No USD/TRY rate available — TCMB unreachable and no DB fallback');
    }
}
