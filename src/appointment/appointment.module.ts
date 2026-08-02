import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmsModule } from 'src/sms/sms.module';
import { ChatFlowModule } from 'src/chat-flow/chat-flow.module';
import { AppointmentReminderService } from './appointment-reminder.service';
import { AppointmentSettingsController } from './appointment-settings.controller';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

@Module({
    imports: [PrismaModule, SmsModule, ChatFlowModule],
    controllers: [AppointmentController, AppointmentSettingsController],
    providers: [AppointmentService, AppointmentReminderService],
    exports: [AppointmentService],
})
export class AppointmentModule { }
