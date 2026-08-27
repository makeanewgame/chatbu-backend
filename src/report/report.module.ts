import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MinioClientModule } from 'src/minio-client/minio-client.module';
import { EventsModule } from 'src/events/events.module';
import { HandoffModule } from 'src/handoff/handoff.module';

@Module({
  imports: [PrismaModule, MinioClientModule, EventsModule, HandoffModule],
  controllers: [ReportController],
  providers: [ReportService]
})
export class ReportModule { }
