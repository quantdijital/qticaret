import { z } from "@medusajs/framework/zod"

/** The shop's Merchant Center account number. */
export const AdminPostGoogleMerchant = z
  .object({
    merchant_id: z
      .string()
      .trim()
      .regex(/^\d{1,20}$/, "google.merchant_id_invalid"),
  })
  .strict()
export type AdminPostGoogleMerchantType = z.infer<typeof AdminPostGoogleMerchant>

/** What Google sends back to the callback: a code, or a refusal; with the state. */
export const GoogleCallbackQuery = z.object({
  state: z.string().max(200).optional(),
  code: z.string().max(2000).optional(),
  error: z.string().max(100).optional(),
})
export type GoogleCallbackQueryType = z.infer<typeof GoogleCallbackQuery>
