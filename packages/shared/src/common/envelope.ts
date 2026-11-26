import { z } from "zod";

// Hợp đồng response bất biến của API: { success: true, data } | { success: false, error, code, details? }.
// `error` là thông báo tiếng Việt cho người dùng; `code` là mã ổn định để client rẽ nhánh.
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export const apiFailureSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
});

export type ApiFailure = z.infer<typeof apiFailureSchema>;

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiResponseSchema<TData extends z.ZodType>(dataSchema: TData) {
  return z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data: dataSchema }),
    apiFailureSchema,
  ]);
}
