import { z } from 'zod';

export const vehicleDataSchema = z.object({
  license_plate: z.string(),
  manufacturer: z.string(),
  model: z.string(),
  year: z.number(),
  color: z.string(),
});

export type VehicleData = z.infer<typeof vehicleDataSchema>;

export const upstreamSuccessSchema = z.object({
  success: z.literal(true),
  data: vehicleDataSchema,
});

export const upstreamErrorSchema = z.object({
  detail: z.object({
    success: z.boolean().optional(),
    error: z.string(),
  }),
});

export const upstreamValidationErrorSchema = z.object({
  detail: z.array(
    z.object({
      type: z.string().optional(),
      loc: z.array(z.union([z.string(), z.number()])).optional(),
      msg: z.string(),
    }),
  ),
});

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
