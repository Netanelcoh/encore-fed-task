import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Correlates a caller's request with everything we log about it. Runs first so
 * even a body-parse failure carries an id the caller can quote back.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 200 ? incoming : randomUUID();

  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export function getRequestId(res: Response): string {
  return typeof res.locals.requestId === 'string' ? res.locals.requestId : 'unknown';
}
