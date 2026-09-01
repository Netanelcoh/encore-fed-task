export function normalizePlate(raw: string): string {
  return raw.trim().replace(/[\s\-.]/g, '');
}

const MIN_DIGITS = 5;
const MAX_DIGITS = 10;
const DIGITS_ONLY = /^\d+$/;

export interface PlateValidation {
  ok: boolean;
  reason?: string;
}

export function validatePlate(normalized: string): PlateValidation {
  if (normalized.length === 0) {
    return { ok: false, reason: 'License plate must not be empty.' };
  }

  if (!DIGITS_ONLY.test(normalized)) {
    return { ok: false, reason: 'License plate must contain digits only.' };
  }

  if (normalized.length < MIN_DIGITS || normalized.length > MAX_DIGITS) {
    return {
      ok: false,
      reason: `License plate must be between ${MIN_DIGITS} and ${MAX_DIGITS} digits.`,
    };
  }

  return { ok: true };
}
