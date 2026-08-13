import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmsService } from './sms.service';
import { NetgsmSmsProvider } from './providers/netgsm.provider';
import { TwilioSmsProvider } from './providers/twilio.provider';
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
// 2026-08-13 provider abstraction: both `NetgsmSmsProvider` and
// `TwilioSmsProvider` are registered here so `SmsService` (the router)
// can inject both. The router picks at request time based on phone
// country + `SMS_PROVIDER_STRATEGY` env. Twilio's SDK is `require`d
// lazily inside the provider so a pod without Twilio credentials
// stays healthy until the first international send.
@Module({
  imports: [HttpModule],
  providers: [
    NetgsmSmsProvider,
    TwilioSmsProvider,
    SmsService,
    chatbuNetgsmSendTotal,
    chatbuSmsSendTotal,
  ],
  exports: [SmsService],
})
export class SmsModule { }
