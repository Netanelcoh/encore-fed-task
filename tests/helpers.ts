import { vi } from 'vitest';
import type { Config } from '../src/config.js';

export const testConfig: Config = {
  port: 8080,
  upstreamBaseUrl: 'https://upstream.test',
  upstreamTimeoutMs: 1000,
  upstreamRetries: 1,
  rateLimitMax: 1000,
  logLevel: 'error',
  corsOrigin: '*',
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html' } });
}

export function timeoutError(): Error {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

export function mockFetch(): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  vi.stubGlobal('fetch', fn);
  return fn;
}

export const VEHICLE = {
  license_plate: '12345678',
  manufacturer: 'טויוטה',
  model: 'קורולה',
  year: 2020,
  color: 'לבן',
};
