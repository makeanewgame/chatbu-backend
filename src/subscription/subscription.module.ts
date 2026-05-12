import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { BillingService } from './billing.service';
import { StripeBootstrapService } from './stripe-bootstrap.service';
import { PricePlanService } from './price-plan.service';
import { SubscriptionController } from './subscription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [PrismaModule, MailModule],
    controllers: [SubscriptionController],
    providers: [SubscriptionService, BillingService, StripeBootstrapService, PricePlanService],
    exports: [SubscriptionService, BillingService, StripeBootstrapService, PricePlanService],
})
export class SubscriptionModule { }
