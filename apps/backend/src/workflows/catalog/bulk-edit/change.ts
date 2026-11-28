import { z } from "@medusajs/framework/zod"
import {
  PRODUCT_BOOKING_MODES,
  PRODUCT_KINDS,
} from "../../../modules/catalog-extension/models/product-extension"

/**
 * One change applied to many products at once (F3.10): the base TRY price,
 * stock at the default warehouse, the status, a category, the SEO texts
 * given back to the shop's templates, the images' missing alt texts, or
 * the variants' unit cost (F11.4), an add-on template (adr/0052 Ek
 * 2026-11-23), the brand, a tag, selling past stock, or the variants' sale
 * price (adr/0086), as WooCommerce's bulk edit has them; or the kind with
 * its booking mode.
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

// adr/0052 Ek 2026-11-23: an add-on template linked to or unlinked from each product
const addonTemplate = z
  .object({
    action: z.literal("addon_template"),
    mode: z.enum(["add", "remove"]),
    template_id: id,
  })
  .strict()

/** The brand set on each product, or taken off with null. */
const brand = z.object({ action: z.literal("brand"), brand_id: id.nullable() }).strict()

/** A tag by its name, letter case aside: `add` makes it when the shop has none. */
export const MAX_TAG_LENGTH = 100
const tag = z
  .object({
    action: z.literal("tag"),
    mode: z.enum(["add", "remove"]),
    value: z.string().trim().min(1).max(MAX_TAG_LENGTH),
  })
  .strict()

/** Selling past stock on or off, for the variants whose stock is tracked. */
const backorder = z.object({ action: z.literal("backorder"), allow: z.boolean() }).strict()

// A share off the regular price: a sale is at most 99% off, as the product page's
const MAX_SALE_PERCENT = 99
const moment = z.iso.datetime({ offset: true }).nullable().default(null)

/**
 * Each variant's sale price (adr/0086): a `percent` or an `amount` off its
 * own regular price, worked out on the server, with optional days; or the
 * sales `clear`ed.
 */
const sale = z
  .object({
    action: z.literal("sale"),
    mode: z.enum(["percent", "amount", "clear"]),
    value: amount.optional(),
    starts_at: moment,
    ends_at: moment,
  })
  .strict()
  .refine(({ mode, value, starts_at, ends_at }) =>
    mode === "clear"
      ? value === undefined && starts_at === null && ends_at === null
      : mode === "percent"
        ? value !== undefined && value > 0 && value <= MAX_SALE_PERCENT
        : value !== undefined && value > 0 && value <= MAX_AMOUNT
  )
  .refine(
    ({ starts_at, ends_at }) =>
      starts_at === null || ends_at === null || new Date(ends_at) > new Date(starts_at),
    { message: "variant_sale.dates_order" }
  )

/**
 * The product's kind (F3.2) and how it is booked (adr/0076 §2), as the
 * product page saves them: a kind other than service is booked by none,
 * so a dated product leaving service stops being dated in the same save.
 */
const kind = z
  .object({
    action: z.literal("kind"),
    kind: z.enum(PRODUCT_KINDS),
    booking_mode: z.enum(PRODUCT_BOOKING_MODES).default("none"),
  })
  .strict()
  .refine(({ kind, booking_mode }) => kind === "service" || booking_mode === "none", {
    message: "catalog.booking_kind",
  })

export const BulkChange = z.union([
  price,
  stock,
  status,
  category,
  seoTemplate,
  altText,
  cost,
  addonTemplate,
  brand,
  tag,
  backorder,
  sale,
  kind,
])
export type BulkChange = z.infer<typeof BulkChange>
export type BulkAction = BulkChange["action"]

/**
 * Products the server finds itself, for an add-on template (2026-11-23):
 * the whole catalogue or a category with those below it. Read a page at
 * a time, with no cap on how many; gift card products are left out.
 */
export const BulkScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("category"), category_id: id }).strict(),
])
export type BulkScope = z.infer<typeof BulkScope>

/** The products named, or (an add-on template only) a scope the server reads. */
export const BulkEditInput = z
  .object({
    product_ids: z
      .array(id)
      .min(1)
      .max(MAX_BULK_PRODUCTS)
      .refine((ids) => new Set(ids).size === ids.length)
      .optional(),
    scope: BulkScope.optional(),
    change: BulkChange,
  })
  .strict()
  .refine(
    ({ product_ids, scope, change }) =>
      scope === undefined
        ? product_ids !== undefined
        : product_ids === undefined && change.action === "addon_template",
    { path: ["scope"] }
  )
export type BulkEditInput = z.infer<typeof BulkEditInput>
