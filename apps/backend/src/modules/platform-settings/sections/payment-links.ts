import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface PaymentLinkSettings {
  /**
   * The largest discount an `admin` may give on a link, as a share of its
   * lines (percent); more is the owner's, whose own limit stays 99 in code.
   */
  admin_max_discount_percent: number
  /** Whether a link's order may be paid at the door (adr/0051 soru 4). */
  allow_cod: boolean
}

/**
 * Payment links (adr/0051 §2, §5): the owner sets them (the admin would
 * otherwise raise their own limit). Cash on delivery still needs its own
 * flag and set-up; this only lets a link's cart take it.
 */
export const paymentLinksSection = defineSection<PaymentLinkSettings>(
  "payment_links",
  {
    admin_max_discount_percent: z.number().int().min(0).max(99),
    allow_cod: z.boolean(),
  },
  { admin_max_discount_percent: 20, allow_cod: false }
)
