import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { GoogleCalendarController } from './google-calendar/google-calendar.controller';
import { GoogleCalendarService } from './google-calendar/google-calendar.service';
import { WhatsAppEmbeddedController } from './whatsapp-embedded/whatsapp-embedded.controller';
import { WhatsAppEmbeddedService } from './whatsapp-embedded/whatsapp-embedded.service';
import { MetaEmbeddedController } from './meta-embedded/meta-embedded.controller';
import { MetaEmbeddedService } from './meta-embedded/meta-embedded.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BookingModule } from './booking/booking.module';
import { ShopifyModule } from './shopify/shopify.module';

@Module({
    imports: [PrismaModule, BookingModule, ShopifyModule],
    controllers: [IntegrationController, GoogleCalendarController, WhatsAppEmbeddedController, MetaEmbeddedController],
    providers: [IntegrationService, GoogleCalendarService, WhatsAppEmbeddedService, MetaEmbeddedService],
    exports: [WhatsAppEmbeddedService, MetaEmbeddedService],
})
export class IntegrationModule { }
