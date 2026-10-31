import { z } from "@medusajs/framework/zod"

/** Which of the order's invoices: its first sale's by default, or an exchange's (E6b). */
export const StoreGetOrderInvoicePdf = z
  .object({
    invoice: z
      .string()
      .regex(/^inv_[0-9A-Za-z]{1,40}$/)
      .optional(),
  })
  .strict()
export type StoreGetOrderInvoicePdfType = z.infer<typeof StoreGetOrderInvoicePdf>
