import type { Config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { normalizePlate, validatePlate } from '../lib/licensePlate.js';
import { logger } from '../lib/logger.js';
import {
  upstreamNotFoundSchema,
  upstreamSuccessSchema,
  upstreamValidationErrorSchema,
  vehicleInfoRequestSchema,
  type VehicleData,
} from '../types.js';

interface LookupOptions {
  requestId: string;
}

const RETRY_BACKOFF_MS = 250;

/** Retry only what might succeed on a second try. A 4xx is a verdict, not a blip. */
function isRetryable(error: unknown): boolean {
  return error instanceof AppError
    ? error.code === 'UPSTREAM_TIMEOUT' || error.code === 'UPSTREAM_ERROR'
    : false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class VehicleClient {
  constructor(private readonly config: Config) {}

  /**
   * Entry point for a caller-supplied request body: validates it, then looks the
   * vehicle up. Resolves with the vehicle, or throws an AppError carrying a
   * stable code — the route never has to interpret anything.
   */
  async lookup(requestBody: unknown, { requestId }: LookupOptions): Promise<VehicleData> {
    const licensePlate = this.parsePlate(requestBody);

    logger.info('vehicle lookup', { requestId, licensePlate });

    return this.fetchWithRetry(licensePlate, requestId);
  }

  /**
   * Rejecting here means obviously-bad input never costs an upstream call, and
   * it produces the same error code the upstream's own 422 maps to — so callers
   * branch identically whichever side made the call.
   */
  private parsePlate(requestBody: unknown): string {
    const invalid = (message: string): never => {
      throw new AppError('INVALID_LICENSE_PLATE', message, {
        source: 'request',
        field: 'license_plate',
      });
    };

    const parsed = vehicleInfoRequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      return invalid(parsed.error.issues[0]?.message ?? 'license_plate is required.');
    }

    const licensePlate = normalizePlate(parsed.data.license_plate);
    const validation = validatePlate(licensePlate);
    if (!validation.ok) {
      return invalid(validation.reason ?? 'Invalid license plate.');
    }

    return licensePlate;
  }

  private async fetchWithRetry(licensePlate: string, requestId: string): Promise<VehicleData> {
    const attempts = this.config.upstreamRetries + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.attemptLookup(licensePlate, requestId, attempt);
      } catch (error) {
        lastError = error;
        if (attempt < attempts && isRetryable(error)) {
          logger.warn('upstream attempt failed, retrying', {
            requestId,
            attempt,
            code: (error as AppError).code,
          });
          await sleep(RETRY_BACKOFF_MS * attempt);
          continue;
        }
        throw error;
      }
    }

    /* istanbul ignore next — loop always returns or throws */
    throw lastError;
  }

  private async attemptLookup(
    licensePlate: string,
    requestId: string,
    attempt: number,
  ): Promise<VehicleData> {
    const url = `${this.config.upstreamBaseUrl}/vehicle-info`;
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ license_plate: licensePlate }),
        signal: AbortSignal.timeout(this.config.upstreamTimeoutMs),
      });
    } catch (error) {
      // A timeout surfaces as TimeoutError; an aborted request as AbortError.
      // Everything else here is a transport failure — DNS, TLS, connection refused.
      const name = error instanceof Error ? error.name : '';
      const isTimeout = name === 'TimeoutError' || name === 'AbortError';

      logger.error('upstream request failed', {
        requestId,
        attempt,
        durationMs: Date.now() - startedAt,
        reason: name || String(error),
      });

      throw isTimeout
        ? new AppError(
            'UPSTREAM_TIMEOUT',
            `Vehicle service did not respond within ${this.config.upstreamTimeoutMs}ms.`,
          )
        : new AppError('UPSTREAM_ERROR', 'Vehicle service is unreachable.');
    }

    const body = await this.readJson(response);

    logger.info('upstream responded', {
      requestId,
      attempt,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    return this.mapResponse(response, body, licensePlate);
  }

  /**
   * Upstream should always send JSON; a non-JSON body means it is misbehaving.
   * Returning undefined rather than throwing lets mapResponse decide, so an
   * unreadable body still becomes UPSTREAM_ERROR instead of a bare 500.
   */
  private async readJson(response: Response): Promise<unknown> {
    let text: string;
    try {
      text = await response.text();
    } catch {
      // The body can fail mid-stream even after the headers arrived.
      return undefined;
    }

    if (text.trim() === '') return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  private mapResponse(response: Response, body: unknown, licensePlate: string): VehicleData {
    if (response.ok) {
      const parsed = upstreamSuccessSchema.safeParse(body);
      if (!parsed.success) {
        // A 200 we cannot trust is an upstream fault, not a client one.
        throw new AppError(
          'UPSTREAM_ERROR',
          'Vehicle service returned an unexpected response format.',
        );
      }
      return parsed.data.data;
    }

    if (response.status === 404) {
      const parsed = upstreamNotFoundSchema.safeParse(body);
      return this.throwNotFound(parsed.success ? parsed.data.detail.error : undefined, licensePlate);
    }

    if (response.status === 400 || response.status === 422) {
      const parsed = upstreamValidationErrorSchema.safeParse(body);
      const messages = parsed.success ? parsed.data.detail.map((entry) => entry.msg) : [];
      throw new AppError(
        'INVALID_LICENSE_PLATE',
        messages[0] ?? 'Vehicle service rejected the license plate format.',
        { upstreamStatus: response.status, upstreamMessages: messages, source: 'upstream' },
      );
    }

    throw new AppError('UPSTREAM_ERROR', 'Vehicle service returned an error.', {
      upstreamStatus: response.status,
    });
  }

  private throwNotFound(upstreamMessage: string | undefined, licensePlate: string): never {
    throw new AppError(
      'VEHICLE_NOT_FOUND',
      upstreamMessage ?? `No vehicle found for license plate ${licensePlate}.`,
      { license_plate: licensePlate },
    );
  }

  /** Used by /ready. Never throws — readiness reports, it does not fail. */
  async checkUpstreamHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.upstreamBaseUrl}/health`, {
        signal: AbortSignal.timeout(this.config.upstreamTimeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
