import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface PaymentSettings {
  /** Whether cards may be paid in installments (F5 V6); one payment otherwise. */
  installments_enabled: boolean
  /** The most installments offered: 2–12, or 0 for what the provider allows the shop. */
  max_installment: number
}

/** Payment choices the shop makes for every card provider (F5 V6). */
export const paymentsSection = defineSection<PaymentSettings>(
  "payments",
  {
    installments_enabled: z.boolean(),
    max_installment: z
      .number()
      .int()
      .refine(
        (value) => value === 0 || (value >= 2 && value <= 12),
        "payments.max_installment_invalid"
      ),
  },
  { installments_enabled: true, max_installment: 0 }
)
