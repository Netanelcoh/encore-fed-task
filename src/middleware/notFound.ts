import type { Request, Response } from 'express';
import type { ApiError } from '../types.js';

export function notFound(req: Request, res: Response): void {
  const payload: ApiError = {
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} does not exist.` },
  };
  res.status(404).json(payload);
}
