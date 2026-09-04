import {
  getToken,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import type { OnModuleInit } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Counter } from 'prom-client';

/**
 * Central provider factory for Chatbu-owned metrics on the NestJS backend.
 *
 * Every custom counter/histogram MUST be listed here AND in the
 * PrometheusModule.register()'s `providers` (see app.module.ts).
 * Consumers inject them by name via
 * `@InjectMetric('chatbu_db_query_duration_seconds') histogram: Histogram`.
 *
 * Registered on prom-client's DEFAULT registry (same as the process
 * metrics from PrometheusModule.register(defaultMetrics: {enabled: true})),
 * so a single scrape at `/api/metrics` returns everything.
 */

/**
 * HTTP request outcomes captured in the global PrometheusHttpInterceptor.
 * `route` is the NestJS route pattern (e.g. `/api/bot/:botId`), NOT the
 * raw path — using the raw path would explode cardinality on any
 * dynamic segment (bot ids, chat ids, etc.).
 */
export const chatbuHttpRequestsTotal = makeCounterProvider({
  name: 'chatbu_http_requests_total',
  help: 'HTTP requests to the NestJS backend, by method + normalised route + status',
  labelNames: ['method', 'route', 'status'] as const,
});

export const chatbuHttpRequestDurationSeconds = makeHistogramProvider({
  name: 'chatbu_http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by method + normalised route',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

/**
 * NETGSM send outcomes after the SmsService retry envelope. Labels:
 *   context: 'otp' | 'booking_confirmation' | 'booking_reminder' | 'generic'
 *     — the same short label the sendSms caller already logs, so a
 *     Grafana panel can slice by SMS purpose without joining logs.
 *   outcome:
 *     'success_on_first' — attempt 1 accepted (00/01), no retry needed
 *     'success_on_retry' — attempt 1 transient-failed, attempt 2 succeeded
 *     'exhausted'        — both attempts transient-failed (permanent from
 *                          caller's perspective)
 *     'permanent_fail'   — attempt 1 hit a non-retryable error (bad
 *                          credentials, malformed request, 4xx) — no
 *                          retry attempted since a second call would fail
 *                          the same way
 * Sustained non-zero on 'success_on_retry' means NETGSM is intermittent
 * (retry earning its keep); sustained non-zero on 'exhausted' means
 * NETGSM is degraded — page ops.
 */
export const chatbuNetgsmSendTotal = makeCounterProvider({
  name: 'chatbu_netgsm_send_total',
  help: 'NETGSM SMS send outcomes after the SmsService retry envelope',
  labelNames: ['context', 'outcome'] as const,
});

/**
 * Provider-agnostic SMS send counter (2026-08-13, alongside the
 * `SmsProvider` abstraction that ships NETGSM + Twilio as sibling
 * transports). Labels:
 *   provider: 'netgsm' | 'twilio' — routed per phone country by
 *             `SmsService.pickProvider`.
 *   context:  same taxonomy as the legacy counter ('otp', 'booking_
 *             confirmation', 'booking_reminder', 'generic') so
 *             existing Grafana queries carry over one-for-one when
 *             pointed at the new metric name.
 *   country:  ISO alpha-2 destination country of the parsed E.164
 *             phone. Cardinality is bounded — every send is
 *             classifiable by libphonenumber; we route by this label
 *             upstream so unbounded free-form is not possible.
 *   outcome:  'success' | 'failure' — the SmsService router increments
 *             AFTER the provider's retry envelope has resolved, so
 *             transient-recovered sends count as success. Detailed
 *             retry breakdown lives on the legacy `chatbu_netgsm_send_
 *             total{outcome}` for now; a follow-up cleanup will bring
 *             the finer-grained outcomes onto this counter and delete
 *             the legacy one.
 *
 * The legacy `chatbu_netgsm_send_total` counter is kept in PARALLEL —
 * do NOT delete it until the alerts + Grafana panels are migrated to
 * `chatbu_sms_send_total`. The overlap costs one extra `inc()` call
 * per send (negligible) and shields the ops surface from a rename
 * during a live rollout.
 */
export const chatbuSmsSendTotal = makeCounterProvider({
  name: 'chatbu_sms_send_total',
  help: 'SMS send outcomes across all providers, sliced by provider + country + context',
  labelNames: ['provider', 'context', 'country', 'outcome'] as const,
});

/**
 * Voice message → transcript pipeline (Slice A of the async voice
 * message plan, 2026-09-01). Three metrics, all labelled by the source
 * `channel` so per-surface breakdowns fall out for free on the Grafana
 * side.
 *
 * Channels — enumerated in `AudioTranscriptionService.VoiceChannel`:
 *   widget | messenger | instagram | whatsapp | wa_test | internal_smoke
 *
 * `.labels(...)` MUST be pre-initialised for the (channel, outcome)
 * combinations Grafana panels query, otherwise the counter series is
 * lazy-materialised on the first `inc()` call and
 * `increase(counter[24h])` reads 0 until then. This is the exact panel-
 * zero foot-gun that prod-broke the SMS lead panel on 2026-08-14 — see
 * `VoiceMessageMetricsPreinit` below.
 */
export const chatbuVoiceMessageTranscribeTotal = makeCounterProvider({
  name: 'chatbu_voice_message_transcribe_total',
  help: 'Voice message transcription outcomes per channel (success/empty/error/unsupported_format)',
  labelNames: ['channel', 'outcome'] as const,
});

export const chatbuVoiceMessageTranscribeDurationSeconds = makeHistogramProvider({
  name: 'chatbu_voice_message_transcribe_duration_seconds',
  help: 'End-to-end transcription latency per channel (ffmpeg decode + AWS Transcribe streaming)',
  labelNames: ['channel'] as const,
  buckets: [0.25, 0.5, 1, 2, 3, 5, 8, 13, 21],
});

export const chatbuVoiceMessageAudioDurationSeconds = makeHistogramProvider({
  name: 'chatbu_voice_message_audio_duration_seconds',
  help: 'Input audio duration per channel — feeds cost/quota panels and outlier detection',
  labelNames: ['channel'] as const,
  buckets: [1, 3, 5, 10, 20, 30, 60, 120],
});

/**
 * Bot-to-bot loop breaker on the Meta channels (2026-09-04 incident:
 * two Chatbu-botted IG accounts ping-ponged ~790 messages / ~400 LLM
 * calls in 24 minutes until the integration was manually disabled).
 * Labels:
 *   channel: messenger | instagram | whatsapp
 *   action:  rate_limited          — pre-LLM breaker tripped, inbound
 *                                    dropped without an LLM call
 *            duplicate_suppressed  — post-LLM byte-identical reply
 *                                    suppressed before the Graph send
 * Sustained non-zero here = a loop (or a spam run) is being actively
 * contained — worth a look, not a page.
 */
export const chatbuMetaLoopGuardTotal = makeCounterProvider({
  name: 'chatbu_meta_loop_guard_total',
  help: 'Meta-channel loop-guard interventions (rate breaker + duplicate reply suppressor)',
  labelNames: ['channel', 'action'] as const,
});

/**
 * Pre-initialises every (channel, outcome) series for the voice
 * message counter at Nest startup, so `sum by (channel) (increase(
 * chatbu_voice_message_transcribe_total[24h]))` reports 0 the first
 * time an outcome fires — not "no data" — on any Grafana panel that
 * ships before the first real event. See [[incident_prometheus_lazy_
 * labels_2026-08-14]].
 */
const VOICE_CHANNELS = [
  'widget',
  'messenger',
  'instagram',
  'whatsapp',
  'wa_test',
  'internal_smoke',
] as const;
const VOICE_OUTCOMES = [
  'success',
  'empty',
  'error',
  'unsupported_format',
] as const;

@Injectable()
export class VoiceMessageMetricsPreinit implements OnModuleInit {
  constructor(
    @Inject(getToken('chatbu_voice_message_transcribe_total'))
    private readonly transcribeCounter: Counter<string>,
    @Inject(getToken('chatbu_meta_loop_guard_total'))
    private readonly loopGuardCounter: Counter<string>,
  ) {}

  onModuleInit(): void {
    for (const channel of VOICE_CHANNELS) {
      for (const outcome of VOICE_OUTCOMES) {
        this.transcribeCounter.labels(channel, outcome);
      }
    }
    for (const channel of ['messenger', 'instagram', 'whatsapp'] as const) {
      for (const action of ['rate_limited', 'duplicate_suppressed'] as const) {
        this.loopGuardCounter.labels(channel, action);
      }
    }
  }
}
