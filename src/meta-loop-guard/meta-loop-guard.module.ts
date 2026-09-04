import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetaLoopGuardService } from './meta-loop-guard.service';
import { chatbuMetaLoopGuardTotal } from '../prometheus/metrics.providers';

@Module({
  imports: [PrometheusModule],
  providers: [MetaLoopGuardService, chatbuMetaLoopGuardTotal],
  exports: [MetaLoopGuardService],
})
export class MetaLoopGuardModule {}
