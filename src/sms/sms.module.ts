import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmsService } from './sms.service';
import { NetgsmSmsProvider } from './providers/netgsm.provider';
import { SnsSmsProvider } from './providers/sns.provider';
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
// 2026-08-13 provider abstraction: `NetgsmSmsProvider` handles TR sends,
// `SnsSmsProvider` handles everything else. `SmsService` (the router)
// injects both and picks per-send based on the parsed phone's country +
// `SMS_PROVIDER_STRATEGY` env. SNS uses IRSA — the backend pod's service
// account carries an `sns:Publish` policy (Terraform patch in the
// `fovi-longa-chat-be` sibling PR) so no credentials appear in code or
// ExternalSecrets. The SNS client is lazily instantiated inside the
// provider so a pod that never routes internationally stays healthy
// even before the SNS sandbox → prod access ticket clears.
@Module({
  imports: [HttpModule],
  providers: [
    NetgsmSmsProvider,
    SnsSmsProvider,
    SmsService,
    chatbuNetgsmSendTotal,
    chatbuSmsSendTotal,
  ],
  exports: [SmsService],
})
export class SmsModule { }
