import { z } from "@medusajs/framework/zod"

/** The currency whose prices are shown. */
export const AdminGetPriceHistory = z
  .object({
    currency_code: z
      .string()
      .regex(/^[a-z]{3}$/i)
      .transform((value) => value.toLowerCase()),
  })
  .strict()
export type AdminGetPriceHistoryType = z.infer<typeof AdminGetPriceHistory>
