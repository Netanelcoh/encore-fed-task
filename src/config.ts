import type { LogLevel } from './lib/logger.js';

export interface Config {
  port: number;
  upstreamBaseUrl: string;
  upstreamTimeoutMs: number;
  upstreamRetries: number;
  rateLimitMax: number;
  logLevel: LogLevel;
  corsOrigin: string;
}

const DEFAULT_UPSTREAM = 'https://insurance-webhook-945894769129.us-central1.run.app';
const LOG_LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error'];

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}".`);
  }
  return value;
}

/** Parsed once at boot. An invalid value crashes the process rather than
 *  producing a service that misbehaves quietly under load. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const upstreamBaseUrl = (env.UPSTREAM_BASE_URL || DEFAULT_UPSTREAM).replace(/\/+$/, '');
  try {
    new URL(upstreamBaseUrl);
  } catch {
    throw new Error(`UPSTREAM_BASE_URL is not a valid URL: "${upstreamBaseUrl}".`);
  }

  const logLevel = env.LOG_LEVEL || 'info';
  if (!LOG_LEVELS.includes(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, got "${logLevel}".`);
  }

  return {
    port: intFromEnv('PORT', 8080, 1, 65535),
    upstreamBaseUrl,
    upstreamTimeoutMs: intFromEnv('UPSTREAM_TIMEOUT_MS', 5000, 100, 60000),
    upstreamRetries: intFromEnv('UPSTREAM_RETRIES', 1, 0, 5),
    rateLimitMax: intFromEnv('RATE_LIMIT_MAX', 60, 1, 100000),
    logLevel: logLevel as LogLevel,
    corsOrigin: env.CORS_ORIGIN || '*',
  };
}
