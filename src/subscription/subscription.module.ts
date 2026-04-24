import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SubscriptionService } from './subscription.service';
import { BillingService } from './billing.service';
import { StripeBootstrapService } from './stripe-bootstrap.service';
import { ExchangeRateService } from './exchange-rate.service';
import { PricePlanService } from './price-plan.service';
import { SubscriptionController } from './subscription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [PrismaModule, MailModule, HttpModule],
    controllers: [SubscriptionController],
    providers: [SubscriptionService, BillingService, StripeBootstrapService, ExchangeRateService, PricePlanService],
    exports: [SubscriptionService, BillingService, StripeBootstrapService, ExchangeRateService, PricePlanService],
})
export class SubscriptionModule { }
