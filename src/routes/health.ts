import { Router, type Request, type Response } from 'express';
import type { VehicleClient } from '../services/vehicleClient.js';

export function healthRouter(client: VehicleClient): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    const upstreamOk = await client.checkUpstreamHealth();
    res.status(upstreamOk ? 200 : 503).json({
      status: upstreamOk ? 'ok' : 'degraded',
      upstream: upstreamOk ? 'ok' : 'unreachable',
    });
  });

  return router;
}
