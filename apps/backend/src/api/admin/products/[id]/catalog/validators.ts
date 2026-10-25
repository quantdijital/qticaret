import { z } from "@medusajs/framework/zod"
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

/**
 * A product's catalog fields (F3.1). Fields left out keep their values,
 * null clears one; whether the IDs fit the product is the workflow's check.
 */
export const AdminPostProductCatalog = z
  .object({
    condition: z.enum(PRODUCT_CONDITIONS).optional(),
    // F3.2: digital and service need the catalog.non_physical flag (checked in the workflow)
    kind: z.enum(PRODUCT_KINDS).optional(),
    primary_category_id: id.nullable().optional(),
    successor_product_id: id.nullable().optional(),
    variants: z
      .record(id, z.object({ mpn: mpn.nullable() }).strict())
      .refine((variants) => Object.keys(variants).length <= MAX_VARIANTS, {
        message: "catalog.variants_too_many",
      })
      .optional(),
  })
  .strict()
export type AdminPostProductCatalogType = z.infer<typeof AdminPostProductCatalog>
