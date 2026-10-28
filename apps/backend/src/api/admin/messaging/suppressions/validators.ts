import { z } from "@medusajs/framework/zod"

/** `?offset=`: the list, newest first, 20 a page. */
export const AdminGetSuppressions = z
  .object({ offset: z.coerce.number().int().min(0).max(100_000).default(0) })
  .strict()
export type AdminGetSuppressionsType = z.infer<typeof AdminGetSuppressions>

/** An address the shop puts on the list itself (the customer asked for no e-mail). */
export const AdminPostSuppression = z
  .object({
    channel: z.enum(["email", "sms"]),
    address: z.string().trim().min(3).max(254),
  })
  .strict()
export type AdminPostSuppressionType = z.infer<typeof AdminPostSuppression>
