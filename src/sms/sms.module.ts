import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmsService } from './sms.service';
import { chatbuNetgsmSendTotal } from '../prometheus/metrics.providers';

// The chatbu_netgsm_send_total counter is also listed in app.module's
// providers array, but Nest resolves per-module and won't inject it into
// SmsService unless the same provider is visible in the SmsModule scope.
// Duplicate `makeCounterProvider` calls collide (prom-client rejects a
// second register()) so we reuse the same provider object here — it's
// idempotent when referenced from multiple modules.
@Module({
  imports: [HttpModule],
  providers: [SmsService, chatbuNetgsmSendTotal],
  exports: [SmsService],
})
export class SmsModule { }
