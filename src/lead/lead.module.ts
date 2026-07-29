import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { SmsModule } from 'src/sms/sms.module';
import { LegalDocumentModule } from 'src/legal-document/legal-document.module';

@Module({
  imports: [PrismaModule, MailModule, SmsModule, JwtModule.register({}), LegalDocumentModule],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule { }
