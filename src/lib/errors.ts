/**
 * Every outcome a vehicle lookup can fail with. The codes and their statuses
 * mirror the upstream's own (400 bad format, 404 not found, 422 validation), so
 * the status a caller sees is the status the upstream meant. Part B's flow
 * branches on these strings — treat renames as breaking.
 *
 * Two codes deliberately live outside this union, because they answer a
 * question about the request rather than about a vehicle: NOT_FOUND (404,
 * middleware/notFound.ts) and RATE_LIMITED (429, app.ts). Both write the same
 * envelope directly instead of throwing an AppError.
 */
export type ErrorCode =
  | 'INVALID_LICENSE_PLATE_FORMAT'
  | 'VEHICLE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_LICENSE_PLATE_FORMAT: 400,
  VEHICLE_NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500, // the upstream failed us
  INTERNAL_ERROR: 500, // we failed — a bug in this service
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
