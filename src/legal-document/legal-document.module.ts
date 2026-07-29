import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { LegalDocumentService } from './legal-document.service';
import { LegalDocumentAdminController } from './legal-document-admin.controller';
import { LegalDocumentPublicController } from './legal-document-public.controller';

@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [LegalDocumentAdminController, LegalDocumentPublicController],
  providers: [LegalDocumentService],
  exports: [LegalDocumentService],
})
export class LegalDocumentModule {}
