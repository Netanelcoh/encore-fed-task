import { Router, type Request, type Response, type NextFunction } from 'express';
import { getRequestId } from '../middleware/requestId.js';
import type { VehicleClient } from '../services/vehicleClient.js';
import type { ApiSuccess } from '../types.js';

export function vehicleInfoRouter(client: VehicleClient): Router {
  const router = Router();

  router.post('/vehicle-info', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await client.lookup(req.body, { requestId: getRequestId(res) });

      const payload: ApiSuccess = { success: true, data };
      res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
