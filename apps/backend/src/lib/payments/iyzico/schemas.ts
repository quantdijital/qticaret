import { z } from "@medusajs/framework/zod"

/** What every iyzico answer carries; a call's own fields extend it. */
export const iyzicoAnswer = z.object({
  status: z.enum(["success", "failure"]),
  // A string in every answer seen; a number would mean the same code
  errorCode: z
    .union([z.string(), z.number()])
    .transform((code) => String(code))
    .optional(),
})
