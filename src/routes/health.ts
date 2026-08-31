import { Router, type Request, type Response } from 'express';
import type { VehicleClient } from '../services/vehicleClient.js';

export function healthRouter(client: VehicleClient): Router {
  const router = Router();

  /** Liveness. Deliberately does not touch the upstream: a dependency being
   *  down is not a reason for the platform to restart this container. */
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  /** Readiness. Reports whether the upstream is answering, for diagnostics. */
  router.get('/ready', async (_req: Request, res: Response) => {
    const upstreamOk = await client.checkUpstreamHealth();
    res.status(upstreamOk ? 200 : 503).json({
      status: upstreamOk ? 'ok' : 'degraded',
      upstream: upstreamOk ? 'ok' : 'unreachable',
    });
  });

  return router;
}
