import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { BillingService } from './billing.service';
import { SubscriptionController } from './subscription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [PrismaModule, MailModule],
    controllers: [SubscriptionController],
    providers: [SubscriptionService, BillingService],
    exports: [SubscriptionService, BillingService],
})
export class SubscriptionModule { }
