import type { Config } from '../config.js';
import { AppError, type ErrorCode } from '../lib/errors.js';
import { normalizePlate, validatePlate } from '../lib/licensePlate.js';
import { logger } from '../lib/logger.js';
import {
  upstreamErrorSchema,
  upstreamSuccessSchema,
  upstreamValidationErrorSchema,
  vehicleInfoRequestSchema,
  type VehicleData,
} from '../types.js';

interface LookupOptions {
  requestId: string;
}

const RETRY_BACKOFF_MS = 250;

function isRetryable(error: unknown): boolean {
  return error instanceof AppError && error.code === 'SERVER_ERROR';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class VehicleClient {
  constructor(private readonly config: Config) {}

  async lookup(requestBody: unknown, { requestId }: LookupOptions): Promise<VehicleData> {
    const licensePlate = this.parsePlate(requestBody);

    logger.info('vehicle lookup', { requestId, licensePlate });

    return this.fetchWithRetry(licensePlate, requestId);
  }

  private parsePlate(requestBody: unknown): string {
    const invalid = (code: ErrorCode, message: string): never => {
      throw new AppError(code, message, { source: 'request', field: 'license_plate' });
    };

    const parsed = vehicleInfoRequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      return invalid(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'license_plate is required.',
      );
    }

    const licensePlate = normalizePlate(parsed.data.license_plate);
    const validation = validatePlate(licensePlate);
    if (!validation.ok) {
      return invalid('INVALID_LICENSE_PLATE_FORMAT', validation.reason ?? 'Invalid license plate.');
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
      const name = error instanceof Error ? error.name : '';
      const isTimeout = name === 'TimeoutError' || name === 'AbortError';

      logger.error('upstream request failed', {
        requestId,
        attempt,
        durationMs: Date.now() - startedAt,
        reason: name || String(error),
      });

      throw new AppError(
        'SERVER_ERROR',
        isTimeout
          ? `Vehicle service did not respond within ${this.config.upstreamTimeoutMs}ms.`
          : 'Vehicle service is unreachable.',
      );
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

  private async readJson(response: Response): Promise<unknown> {
    let text: string;
    try {
      text = await response.text();
    } catch {
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
        throw new AppError('SERVER_ERROR', 'Vehicle service returned an unexpected response format.');
      }
      return parsed.data.data;
    }

    const detail = upstreamErrorSchema.safeParse(body);
    const upstreamMessage = detail.success ? detail.data.detail.error : undefined;

    if (response.status === 404) {
      throw new AppError(
        'VEHICLE_NOT_FOUND',
        upstreamMessage ?? `No vehicle found for license plate ${licensePlate}.`,
        { license_plate: licensePlate },
      );
    }

    if (response.status === 400) {
      throw new AppError(
        'INVALID_LICENSE_PLATE_FORMAT',
        upstreamMessage ?? 'Vehicle service rejected the license plate format.',
        { license_plate: licensePlate, source: 'upstream' },
      );
    }

    if (response.status === 422) {
      const parsed = upstreamValidationErrorSchema.safeParse(body);
      const messages = parsed.success ? parsed.data.detail.map((entry) => entry.msg) : [];
      throw new AppError(
        'VALIDATION_ERROR',
        messages[0] ?? 'Vehicle service rejected the request body.',
        { upstreamMessages: messages, source: 'upstream' },
      );
    }

    throw new AppError('SERVER_ERROR', 'Vehicle service returned an error.', {
      upstreamStatus: response.status,
    });
  }

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
