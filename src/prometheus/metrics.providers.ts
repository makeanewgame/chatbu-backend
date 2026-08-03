import {
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

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
