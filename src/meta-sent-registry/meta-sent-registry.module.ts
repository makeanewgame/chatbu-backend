import { Module } from '@nestjs/common';
import { MetaSentRegistryService } from './meta-sent-registry.service';

@Module({
  providers: [MetaSentRegistryService],
  exports: [MetaSentRegistryService],
})
export class MetaSentRegistryModule {}
