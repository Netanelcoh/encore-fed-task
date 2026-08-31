import { describe, expect, it } from 'vitest';
import { normalizePlate, validatePlate } from '../src/lib/licensePlate.js';

describe('normalizePlate', () => {
  const cases: Array<[string, string]> = [
    ['12345678', '12345678'],
    ['12-345-67', '1234567'],
    ['12 345 678', '12345678'],
    ['  12345678  ', '12345678'],
    ['', ''],
    // Letters survive normalization on purpose, so validation can reject them
    // instead of the plate being silently rewritten to a different vehicle.
    ['abc', 'abc'],
    ['abc12345', 'abc12345'],
  ];

  it.each(cases)('normalizes %j to %j', (input, expected) => {
    expect(normalizePlate(input)).toBe(expected);
  });
});

describe('validatePlate', () => {
  it('accepts 7 and 8 digit plates', () => {
    expect(validatePlate('1234567').ok).toBe(true);
    expect(validatePlate('12345678').ok).toBe(true);
  });

  it('rejects empty input', () => {
    const result = validatePlate('');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  it('rejects input containing letters', () => {
    for (const input of ['abc', 'abc12345', '1234567a', '12/345/67']) {
      const result = validatePlate(input);
      expect(result.ok, `expected ${input} to be rejected`).toBe(false);
      expect(result.reason).toMatch(/digits only/i);
    }
  });

  it('rejects lengths far outside the plausible range', () => {
    expect(validatePlate('1234').ok).toBe(false);
    expect(validatePlate('12345678901').ok).toBe(false);
  });

  it('lets borderline lengths through so upstream is the authority', () => {
    // 9 digits is invalid upstream, but we do not duplicate that rule locally;
    // the upstream 422 maps to the same error code the caller sees anyway.
    expect(validatePlate('123456789').ok).toBe(true);
  });
});
