import type { Request, Response } from 'express';
import type { ApiError } from '../types.js';

/**
 * Anything reaching here matched no route. It answers with the same JSON
 * envelope as every other failure, rather than Express's default HTML page.
 *
 * NOT_FOUND is deliberately not an ErrorCode: it is a verdict on the URL, not
 * on a vehicle lookup, so it never travels as an AppError and can never be
 * confused with VEHICLE_NOT_FOUND by a caller branching on the code.
 */
export function notFound(req: Request, res: Response): void {
  const payload: ApiError = {
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} does not exist.` },
  };
  res.status(404).json(payload);
}
