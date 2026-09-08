import { Module } from '@nestjs/common';

import { SmsModule } from '../sms/sms.module';
import { LeadModule } from '../lead/lead.module';
import { BookingModule } from '../integration/booking/booking.module';
import { TwilioStatusController } from './twilio-status.controller';

@Module({
    imports: [SmsModule, LeadModule, BookingModule],
    controllers: [TwilioStatusController],
})
export class TwilioStatusModule { }
