import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { jsonResponse, mockFetch, testConfig, textResponse, timeoutError, VEHICLE } from './helpers.js';

let fetchMock: ReturnType<typeof mockFetch>;
const app = () => createApp(testConfig);

beforeEach(() => {
  fetchMock = mockFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/vehicle-info — success', () => {
  it('returns the vehicle in the success envelope', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, data: VEHICLE }));

    const res = await request(app())
      .post('/api/vehicle-info')
      .send({ license_plate: '12345678' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: VEHICLE });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('passes Hebrew values through untouched', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, data: VEHICLE }));

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.body.data.manufacturer).toBe('טויוטה');
    expect(res.body.data.color).toBe('לבן');
  });

  it('strips separators before calling upstream', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, data: VEHICLE }));

    await request(app()).post('/api/vehicle-info').send({ license_plate: '12-345-67' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.license_plate).toBe('1234567');
  });

  it('echoes an incoming x-request-id', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, data: VEHICLE }));

    const res = await request(app())
      .post('/api/vehicle-info')
      .set('x-request-id', 'trace-abc')
      .send({ license_plate: '12345678' });

    expect(res.headers['x-request-id']).toBe('trace-abc');
  });
});

describe('POST /api/vehicle-info — client errors', () => {
  it('rejects a missing license_plate without calling upstream', async () => {
    const res = await request(app()).post('/api/vehicle-info').send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-string license_plate', async () => {
    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: 12345678 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a plate with no digits without calling upstream', async () => {
    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_LICENSE_PLATE_FORMAT');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with the same envelope', async () => {
    const res = await request(app())
      .post('/api/vehicle-info')
      .set('Content-Type', 'application/json')
      .send('{"license_plate":');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/vehicle-info — upstream mapping', () => {
  it('maps a 404 to VEHICLE_NOT_FOUND and keeps the upstream message', async () => {
    fetchMock.mockImplementation(async () => 
      jsonResponse(404, {
        detail: { success: false, error: 'רכב עם מספר 99999999 לא נמצא במאגר' },
      }),
    );

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '99999999' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VEHICLE_NOT_FOUND');
    expect(res.body.error.message).toBe('רכב עם מספר 99999999 לא נמצא במאגר');
  });

  it('flattens a pydantic 422 array into VALIDATION_ERROR', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(422, {
        detail: [
          {
            type: 'value_error',
            loc: ['body', 'license_plate'],
            msg: 'Value error, מספר רכב חייב להיות 7 או 8 ספרות',
          },
        ],
      }),
    );

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Value error, מספר רכב חייב להיות 7 או 8 ספרות');
    expect(res.body.error.details.source).toBe('upstream');
  });

  it('maps a 400 to INVALID_LICENSE_PLATE_FORMAT and keeps the upstream message', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(400, {
        detail: { success: false, error: 'פורמט מספר רכב לא תקין' },
      }),
    );

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_LICENSE_PLATE_FORMAT');
    expect(res.body.error.message).toBe('פורמט מספר רכב לא תקין');
  });

  it('does not retry a 404', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(404, { detail: { error: 'not found' } }));

    await request(app()).post('/api/vehicle-info').send({ license_plate: '99999999' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps an unparseable 200 body to SERVER_ERROR', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, data: { nope: 1 } }));

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SERVER_ERROR');
  });

  it('maps a non-JSON body to SERVER_ERROR', async () => {
    fetchMock.mockImplementation(async () => textResponse(200, '<html>gateway</html>'));

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SERVER_ERROR');
  });
});

describe('POST /api/vehicle-info — upstream unavailable', () => {
  it('maps a timeout to SERVER_ERROR after retrying', async () => {
    fetchMock.mockRejectedValue(timeoutError());

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SERVER_ERROR');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps a transport failure to SERVER_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SERVER_ERROR');
  });

  it('maps a 500 to SERVER_ERROR', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(500, { detail: 'boom' }));

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SERVER_ERROR');
  });

  it('recovers when the retry succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(timeoutError())
      .mockImplementationOnce(async () => jsonResponse(200, { success: true, data: VEHICLE }));

    const res = await request(app()).post('/api/vehicle-info').send({ license_plate: '12345678' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('unknown routes', () => {
  it('returns the standard envelope, not HTML', async () => {
    const res = await request(app()).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
