import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { jsonResponse, mockFetch, testConfig, timeoutError } from './helpers.js';

let fetchMock: ReturnType<typeof mockFetch>;

beforeEach(() => {
  fetchMock = mockFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /health', () => {
  it('reports ok without touching the upstream', async () => {
    const res = await request(createApp(testConfig)).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /ready', () => {
  it('reports ok when the upstream answers', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { status: 'ok' }));

    const res = await request(createApp(testConfig)).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body.upstream).toBe('ok');
  });

  it('reports degraded when the upstream is unreachable', async () => {
    fetchMock.mockRejectedValue(timeoutError());

    const res = await request(createApp(testConfig)).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.upstream).toBe('unreachable');
  });
});
