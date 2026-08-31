/**
 * Strips the separators plates are written with (12-345-67, "12 345 678"), so
 * the plate we validate is the bare-digit plate the upstream looks up.
 *
 * Only separators — not every non-digit. The upstream strips all of them, so it
 * would read "abc12345" as "12345" and answer about a different vehicle.
 * Keeping stray characters lets validation reject that rather than silently
 * rewriting it.
 */
export function normalizePlate(raw: string): string {
  return raw.trim().replace(/[\s\-.]/g, '');
}

/**
 * Length bounds are looser than the upstream's own rule (7 or 8 digits), which
 * was inferred by probing rather than read from a contract. Copying it exactly
 * means that if the upstream widens its format we silently reject valid plates.
 * Being too loose costs one wasted round trip instead, and both verdicts
 * converge on INVALID_LICENSE_PLATE, so callers branch identically either way.
 */
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
