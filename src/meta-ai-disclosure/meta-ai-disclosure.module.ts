import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { MetaAiDisclosureService } from './meta-ai-disclosure.service';

@Module({
  imports: [PrismaModule],
  providers: [MetaAiDisclosureService],
  exports: [MetaAiDisclosureService],
})
export class MetaAiDisclosureModule {}
