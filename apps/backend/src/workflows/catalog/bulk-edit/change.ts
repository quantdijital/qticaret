import { z } from "@medusajs/framework/zod"

/**
 * One change applied to many products at once (F3.10): the base TRY price,
 * stock at the default warehouse, the status, a category, the SEO texts
 * given back to the shop's templates, the images' missing alt texts, or
 * the variants' unit cost (F11.4).
 */

/** Products one run takes; the panel selects at most this many. */
export const MAX_BULK_PRODUCTS = 1000

// Amounts and quantities as the sheet takes them (F3.9)
export const MAX_AMOUNT = 1_000_000_000
export const MAX_QUANTITY = 1_000_000_000
// A unit cost in lira, as the product page takes it
export const MAX_COST = 10_000_000
// A price falls by at most 99% and rises by at most 1000%
const MIN_PERCENT = -99
const MAX_PERCENT = 1000

const id = z.string().min(1).max(64)
// To the kuruş: a percent of 12.25 or an amount of 9.99, nothing finer
const amount = z.number().multipleOf(0.01)

const price = z
  .object({
    action: z.literal("price"),
    /** `set` the price; change it by a `percent` or by an `amount` (negative lowers it). */
    mode: z.enum(["set", "percent", "amount"]),
    value: amount,
  })
  .strict()
  .refine(({ mode, value }) =>
    mode === "set"
      ? value > 0 && value <= MAX_AMOUNT
      : mode === "percent"
        ? value !== 0 && value >= MIN_PERCENT && value <= MAX_PERCENT
        : value !== 0 && Math.abs(value) <= MAX_AMOUNT
  )

const stock = z
  .object({
    action: z.literal("stock"),
    /** `set` the quantity, or `adjust` it by a number (negative takes away). */
    mode: z.enum(["set", "adjust"]),
    value: z.number().int(),
  })
  .strict()
  .refine(({ mode, value }) =>
    mode === "set"
      ? value >= 0 && value <= MAX_QUANTITY
      : value !== 0 && Math.abs(value) <= MAX_QUANTITY
  )

const status = z
  .object({ action: z.literal("status"), status: z.enum(["published", "draft"]) })
  .strict()

const category = z
  .object({
    action: z.literal("category"),
    /** `add` to it, `remove` from it, or make it the `primary` one (added if missing). */
    mode: z.enum(["add", "remove", "primary"]),
    category_id: id,
  })
  .strict()

const seoTemplate = z
  .object({
    action: z.literal("seo_template"),
    fields: z
      .array(z.enum(["seo_title", "seo_description"]))
      .min(1)
      .max(2),
  })
  .strict()

const altText = z.object({ action: z.literal("alt_text") }).strict()

const cost = z
  .object({
    action: z.literal("cost"),
    /** `set` every variant's unit cost (lira, VAT excluded), change one by a `percent`, or `clear` it. */
    mode: z.enum(["set", "percent", "clear"]),
    value: amount.optional(),
  })
  .strict()
  .refine(({ mode, value }) =>
    mode === "clear"
      ? value === undefined
      : mode === "set"
        ? value !== undefined && value >= 0 && value <= MAX_COST
        : value !== undefined && value !== 0 && value >= MIN_PERCENT && value <= MAX_PERCENT
  )

export const BulkChange = z.union([price, stock, status, category, seoTemplate, altText, cost])
export type BulkChange = z.infer<typeof BulkChange>
export type BulkAction = BulkChange["action"]

export const BulkEditInput = z
  .object({
    product_ids: z
      .array(id)
      .min(1)
      .max(MAX_BULK_PRODUCTS)
      .refine((ids) => new Set(ids).size === ids.length),
    change: BulkChange,
  })
  .strict()
export type BulkEditInput = z.infer<typeof BulkEditInput>
