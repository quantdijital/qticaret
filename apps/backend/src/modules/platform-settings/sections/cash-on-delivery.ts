import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface CashOnDeliverySettings {
  /** How the fee is worked out: none, a fixed amount, or a share of the order. */
  fee_type: "none" | "fixed" | "percent"
  /** Kuruş for a fixed fee, basis points (1/100 of a percent) for a share. */
  fee_value: number
  /** The largest order (kuruş, goods and shipping) paid at the door; 0: no limit. */
  max_amount: number
  /** Shipping options whose courier collects at the door; none chosen: none offer it. */
  shipping_option_ids: string[]
}

/**
 * Cash on delivery (F6 W3, adr/0029). Offered only with the
 * `cash_on_delivery` flag on, an order under the limit and a shipping
 * option the shop marked as collecting at the door.
 */
export const cashOnDeliverySection = defineSection<CashOnDeliverySettings>(
  "cash_on_delivery",
  {
    fee_type: z.enum(["none", "fixed", "percent"]),
    fee_value: z.number().int().min(0).max(10_000_000),
    max_amount: z.number().int().min(0).max(1_000_000_000),
    shipping_option_ids: z.array(z.string().regex(/^so_[0-9A-Za-z]{1,40}$/)).max(50),
  },
  { fee_type: "none", fee_value: 0, max_amount: 0, shipping_option_ids: [] },
  (values, ctx) => {
    // A share is at most the whole order
    if (values.fee_type === "percent" && values.fee_value > 10_000) {
      ctx.addIssue({ code: "custom", path: ["fee_value"], message: "cash_on_delivery.fee_invalid" })
    }
  }
)
