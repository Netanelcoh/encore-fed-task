/**
 * Every failure the service can express. Part B's flow branches on these
 * strings, so they are part of the public contract — treat renames as breaking.
 */
export type ErrorCode =
  | 'INVALID_LICENSE_PLATE'
  | 'VEHICLE_NOT_FOUND'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_LICENSE_PLATE: 400,
  VEHICLE_NOT_FOUND: 404,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}

/**
 * Thrown anywhere in the request path; serialised in exactly one place
 * (middleware/errorHandler.ts) so no route can invent its own error shape.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = statusForCode(code);
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace?.(this, AppError);
  }
}
