import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { IntegrationScheduleService } from './integration-schedule.service';

/**
 * Standalone so the webhook ingress modules (Meta, Meta-WhatsApp, legacy
 * WhatsApp) can consume the schedule check without pulling the full
 * IntegrationModule (Booking / Shopify / Google Calendar) into their graph.
 */
@Module({
    imports: [PrismaModule],
    providers: [IntegrationScheduleService],
    exports: [IntegrationScheduleService],
})
export class IntegrationScheduleModule {}
