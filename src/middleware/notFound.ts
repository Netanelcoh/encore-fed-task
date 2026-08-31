import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';

/**
 * Anything reaching here matched no route. Handing it to the error handler
 * keeps a typo'd URL returning the same JSON envelope as every other failure,
 * rather than Express's default HTML page.
 */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.path} does not exist.`));
}
