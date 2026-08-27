import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventsModule } from 'src/events/events.module';
import { MailModule } from 'src/mail/mail.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { HandoffNotificationService } from './handoff-notification.service';

@Module({
    imports: [PrismaModule, EventsModule, MailModule, PushNotificationModule],
    providers: [HandoffNotificationService],
    exports: [HandoffNotificationService],
})
export class HandoffModule { }
