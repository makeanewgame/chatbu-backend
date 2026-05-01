import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { GoogleCalendarController } from './google-calendar/google-calendar.controller';
import { GoogleCalendarService } from './google-calendar/google-calendar.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BookingModule } from './booking/booking.module';

@Module({
    imports: [PrismaModule, BookingModule],
    controllers: [IntegrationController, GoogleCalendarController],
    providers: [IntegrationService, GoogleCalendarService],
})
export class IntegrationModule { }
