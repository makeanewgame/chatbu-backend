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
