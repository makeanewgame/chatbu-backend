import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmsService } from './sms.service';
import { NetgsmSmsProvider } from './providers/netgsm.provider';
import {
  chatbuNetgsmSendTotal,
  chatbuSmsSendTotal,
} from '../prometheus/metrics.providers';

// The chatbu_netgsm_send_total counter is also listed in app.module's
// providers array, but Nest resolves per-module and won't inject it into
// SmsService unless the same provider is visible in the SmsModule scope.
// Duplicate `makeCounterProvider` calls collide (prom-client rejects a
// second register()) so we reuse the same provider object here — it's
// idempotent when referenced from multiple modules.
//
// 2026-08-13 provider abstraction: `NetgsmSmsProvider` is the sole
// registered transport for now; `SmsService` (the router) is shaped to
// accept additional providers behind the same interface. The second
// provider (AWS SNS in the current plan) will register here in the
// follow-up Slice 2 PR.
@Module({
  imports: [HttpModule],
  providers: [
    NetgsmSmsProvider,
    SmsService,
    chatbuNetgsmSendTotal,
    chatbuSmsSendTotal,
  ],
  exports: [SmsService],
})
export class SmsModule { }
