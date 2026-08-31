import { z } from 'zod';

/** Vehicle payload as returned by the upstream service. Values arrive in Hebrew. */
export const vehicleDataSchema = z.object({
  license_plate: z.string(),
  manufacturer: z.string(),
  model: z.string(),
  year: z.number(),
  color: z.string(),
});

export type VehicleData = z.infer<typeof vehicleDataSchema>;

/** Upstream 200 body. */
export const upstreamSuccessSchema = z.object({
  success: z.literal(true),
  data: vehicleDataSchema,
});

/**
 * Upstream 404 body. FastAPI wraps the handler's payload in `detail`:
 *   { "detail": { "success": false, "error": "רכב עם מספר ... לא נמצא במאגר" } }
 */
export const upstreamNotFoundSchema = z.object({
  detail: z.object({
    success: z.boolean().optional(),
    error: z.string(),
  }),
});

/**
 * Upstream 422 body — a pydantic validation array, a different shape entirely
 * from the 404 above. Normalising these two into one envelope is most of the
 * reason this wrapper exists.
 */
export const upstreamValidationErrorSchema = z.object({
  detail: z.array(
    z.object({
      type: z.string().optional(),
      loc: z.array(z.union([z.string(), z.number()])).optional(),
      msg: z.string(),
    }),
  ),
});

/** Request body accepted by POST /api/vehicle-info. */
export const vehicleInfoRequestSchema = z.object({
  license_plate: z.string({
    required_error: 'license_plate is required.',
    invalid_type_error: 'license_plate must be a string.',
  }),
});

export interface ApiSuccess {
  success: true;
  data: VehicleData;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse = ApiSuccess | ApiError;
