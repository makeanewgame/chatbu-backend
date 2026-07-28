import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { SmsModule } from 'src/sms/sms.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
    imports: [PrismaModule, MailModule, SmsModule, JwtModule.register({})],
    controllers: [BookingController],
    providers: [BookingService],
})
export class BookingModule { }
