import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  // `bufferLogs: true` makes Nest hold every framework log line until we
  // wire in our own logger below. Without this, Nest's default color/
  // pretty-printed bootstrap output (module loaded, route mapped, …)
  // reaches stdout BEFORE `useLogger(...)` runs and Alloy's Winston-JSON
  // parser downstream ignores those non-JSON lines. Loki's
  // `| level=~"ERROR"` filter then misses every backend error emitted
  // during startup or startup-adjacent moments.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  // Route Nest's own framework logs through the same nest-winston
  // provider AppModule registers with `winston.format.json()`. From here
  // on out every backend log line — Nest framework AND application —
  // is a single JSON object per line, parseable by Alloy's
  // `stage.match {container="backend"} { stage.json ... }` pipeline.
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  // Trust the ingress/load-balancer's X-Forwarded-For so ThrottlerGuard
  // uses the real client IP instead of the cluster-internal ingress IP.
  // Without this, all users share one throttle bucket → 429 → health-probe
  // failures → K8s marks pods unhealthy → 503.
  app.set('trust proxy', 1);
  const configService = app.get(ConfigService);

  // Enable global validation + automatic query-string → number/boolean coercion.
  // Without transform:true, @Type(() => Number) in DTOs has no effect and
  // Prisma receives string values, causing PrismaClientValidationError.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const port = configService.get<number>('PORT');

  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.setGlobalPrefix('api');

  // Stripe webhook needs raw body for signature verification
  app.use('/api/subscription/webhook', bodyParser.raw({ type: 'application/json' }));

  app.use(bodyParser.json({ limit: '20mb' }));
  app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));
  const rawOrigin = configService.get<string>('CORS_ORIGIN') ?? '';
  const allowedOrigins = rawOrigin.includes(',')
    ? rawOrigin.split(',').map((o) => o.trim())
    : rawOrigin;

  // Embed widget runs on third-party sites, so requests come from arbitrary
  // origins. Auth is handled by JWT / bot tokens, not cookies — safe to allow.
  app.enableCors({
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) return callback(null, true);
      // Allow configured origins (dashboard)
      if (Array.isArray(allowedOrigins)
        ? allowedOrigins.includes(origin)
        : allowedOrigins === origin
      ) {
        return callback(null, true);
      }
      // Allow any other origin for embed widget API calls (credentials omitted)
      return callback(null, true);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204
  });

  // Swagger exposes the full API surface (routes, DTOs, auth schemes) — keep
  // it out of production so it isn't publicly discoverable at /api.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Chatbu API')
      .setDescription('The chatbu api description')
      .setVersion('1.0')
      .addTag('chatbu')
      .addBearerAuth()
      .addOAuth2()
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, documentFactory);
  }

  await app.listen(port || 3001);
  app.useStaticAssets(join(__dirname, '../../', 'public'));

  console.log(`Application is running port: ${port || 3001}`);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
