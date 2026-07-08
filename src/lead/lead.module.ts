import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule, JwtModule.register({})],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule { }
