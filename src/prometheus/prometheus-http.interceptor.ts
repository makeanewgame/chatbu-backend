import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap, catchError, throwError } from 'rxjs';

/**
 * Global HTTP metrics interceptor.
 *
 * Registered as APP_INTERCEPTOR in app.module.ts so every controller
 * request goes through it.
 *
 * Labels use the NestJS route pattern (`req.route?.path`) instead of the
 * raw URL — cardinality would explode otherwise because most controllers
 * take a `:botId` / `:chatId` / `:userId` path parameter. When the pattern
 * isn't available (e.g. 404 before any route matched, or a `use()` middleware
 * short-circuit), we fall back to `unknown` so the counter still fires and
 * we can see the 404 rate at all.
 */
@Injectable()
export class PrometheusHttpInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('chatbu_http_requests_total')
    private readonly counter: Counter<string>,
    @InjectMetric('chatbu_http_request_duration_seconds')
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method: string = req.method ?? 'UNKNOWN';
    const route: string = req.route?.path ?? req.url ?? 'unknown';
    const started = process.hrtime.bigint();

    const record = (status: number) => {
      const durationSec =
        Number(process.hrtime.bigint() - started) / 1_000_000_000;
      this.counter.labels(method, route, String(status)).inc();
      this.histogram.labels(method, route).observe(durationSec);
    };

    return next.handle().pipe(
      tap(() => record(res.statusCode)),
      catchError((err) => {
        // NestJS wraps controller errors — we still want to observe them.
        const status =
          typeof err?.getStatus === 'function' ? err.getStatus() : 500;
        record(status);
        return throwError(() => err);
      }),
    );
  }
}
