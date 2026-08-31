import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { ApiError } from '../types.js';
import { getRequestId } from './requestId.js';

function isBodyParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: number }).status === 400 &&
    'body' in error
  );
}

/**
 * The single place an error envelope is written. Every other module just throws
 * an AppError; nothing else serialises. That is what guarantees a caller never
 * meets a response shape it was not built to parse.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = getRequestId(res);

  // express.json() rejected the payload before any route ran.
  if (isBodyParseError(error)) {
    logger.warn('malformed request body', { requestId });
    respond(res, 400, {
      success: false,
      error: { code: 'INVALID_LICENSE_PLATE', message: 'Request body must be valid JSON.' },
    });
    return;
  }

  if (error instanceof AppError) {
    const level = error.status >= 500 ? 'error' : 'warn';
    logger[level]('request failed', { requestId, code: error.code, status: error.status });

    const payload: ApiError = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    if (error.details !== undefined) {
      payload.error.details = error.details;
    }
    respond(res, error.status, payload);
    return;
  }

  // An unexpected throw is a bug in this service. Log the stack, return nothing
  // internal — callers get a generic code they can still branch on.
  logger.error('unhandled error', {
    requestId,
    reason: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  respond(res, 500, {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}

function respond(res: Response, status: number, payload: ApiError): void {
  res.status(status).json(payload);
}
