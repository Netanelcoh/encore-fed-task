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

export function createApp(config: Config): Express {
  const app = express();
  const client = new VehicleClient(config);

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
    }),
  );

  app.use(requestId);

  app.use(express.json({ limit: '10kb' }));

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

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
