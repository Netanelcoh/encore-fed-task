import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import type { Config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './routes/health.js';
import { vehicleInfoRouter } from './routes/vehicleInfo.js';
import { VehicleClient } from './services/vehicleClient.js';

/**
 * Builds the app without listening, so tests can drive it via supertest.
 * Middleware order matters and is documented inline.
 */
export function createApp(config: Config): Express {
  const app = express();
  const client = new VehicleClient(config);

  // Behind Cloud Run / Render / Fly there is always a proxy in front; without
  // this the rate limiter would see the proxy IP for every caller.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
    }),
  );

  // First, so every log line and every error response carries a correlation id.
  app.use(requestId);

  // Small cap: the only legitimate body is a single short license plate.
  app.use(express.json({ limit: '10kb' }));

  // Health checks are never throttled, so limiting is scoped to /api.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' },
      },
    }),
  );

  app.use(healthRouter(client));
  app.use('/api', vehicleInfoRouter(client));

  // Unmatched routes answer with the standard envelope; everything thrown by a
  // route is serialised once, in errorHandler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
