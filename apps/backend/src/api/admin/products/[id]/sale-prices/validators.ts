import { z } from "@medusajs/framework/zod"

/** The most a price may be: 20 million lira, inside the column's integer (as wholesale). */
const MAX_LIRA = 20_000_000

/** Lira with up to two decimals ("1250.50"), as Medusa writes amounts; never zero. */
const amount = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0 && Number(value) <= MAX_LIRA)

const variantId = z.string().min(1).max(100)
const moment = z.iso.datetime({ offset: true }).nullable().default(null)

/**
 * A variant's sale (adr/0086): a price, or a percentage off its own price
 * worked out on the server; its days optional (open on either side).
 */
const SaleEntry = z
  .object({
    variant_id: variantId,
    amount: amount.optional(),
    percent: z.number().multipleOf(0.01).min(0.01).max(99).optional(),
    starts_at: moment,
    ends_at: moment,
  })
  .strict()
  .refine((entry) => (entry.amount === undefined) !== (entry.percent === undefined), {
    message: "variant_sale.amount_or_rate",
  })

/** Sales set and cleared on one product's variants; at most 500 a request. */
export const AdminPostSalePrices = z
  .object({
    set: z.array(SaleEntry).max(500).default([]),
    clear: z.array(variantId).max(500).default([]),
  })
  .strict()
  .refine((body) => body.set.length + body.clear.length > 0)
export type AdminPostSalePricesType = z.infer<typeof AdminPostSalePrices>
