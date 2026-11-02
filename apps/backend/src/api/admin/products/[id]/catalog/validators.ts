import { z } from "@medusajs/framework/zod"
import { RESTRICTIONS } from "../../../../../lib/catalog"
import { isCleanText } from "../../../../../lib/security"
import {
  PRODUCT_CONDITIONS,
  PRODUCT_KINDS,
} from "../../../../../modules/catalog-extension/models/product-extension"

// Medusa IDs are short; a variant list is bounded by what a product carries
const id = z.string().min(1).max(64)
const MAX_VARIANTS = 500

// Invisible and direction-changing characters (zero-width, bidi overrides):
// an identifier has no use for them, and they disguise text in lists and feeds
const FORMAT_CHARACTER = /\p{Cf}/u

// Google's limit for `mpn`; control characters would reach feeds and JSON-LD
const mpn = z
  .string()
  .trim()
  .min(1)
  .max(70)
  .refine((text) => isCleanText(text) && !FORMAT_CHARACTER.test(text), {
    message: "catalog.mpn_invalid",
  })

// A unit cost in lira, VAT excluded (F11.4): to the kuruş, ten million at most
const cost = z
  .number()
  .refine(
    (value) =>
      value >= 0 && value <= 10_000_000 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    { message: "catalog.cost_invalid" }
  )

/**
 * A product's catalog fields (F3.1) and its variants' MPNs and unit costs
 * (F11.4). Fields left out keep their values,
 * null clears one; whether the IDs fit the product is the workflow's check.
 */
export const AdminPostProductCatalog = z
  .object({
    condition: z.enum(PRODUCT_CONDITIONS).optional(),
    // F3.2: digital and service need the catalog.non_physical flag (checked in the workflow)
    kind: z.enum(PRODUCT_KINDS).optional(),
    primary_category_id: id.nullable().optional(),
    successor_product_id: id.nullable().optional(),
    // F13.6: hygiene, made to order; a faulty item still comes back
    withdrawal_excluded: z.boolean().optional(),
    // F13.4: adults only, and why; needs the catalog.restricted flag (checked in the workflow)
    restriction: z.enum(RESTRICTIONS).nullable().optional(),
    // adr/0025 Ek 2026-11-03: its variants are gift card amounts; needs promotions.gift_cards
    is_gift_card: z.boolean().optional(),
    variants: z
      .record(
        id,
        z.object({ mpn: mpn.nullable().optional(), cost: cost.nullable().optional() }).strict()
      )
      .refine((variants) => Object.keys(variants).length <= MAX_VARIANTS, {
        message: "catalog.variants_too_many",
      })
      .optional(),
  })
  .strict()
export type AdminPostProductCatalogType = z.infer<typeof AdminPostProductCatalog>
