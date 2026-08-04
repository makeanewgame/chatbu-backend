import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';

@Module({
    imports: [PrismaModule, JwtModule.register({})],
    controllers: [PushNotificationController],
    providers: [PushNotificationService],
    exports: [PushNotificationService],
})
export class PushNotificationModule { }
