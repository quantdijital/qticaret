import { toSlug } from "../../../seo/slug"
import type { SourceProduct } from "../../types"
import type { Attribute } from "./variations"

/**
 * A product's descriptive attributes (`_product_attributes` not used for
 * variations) as the migration hands them on (adr/0042 Ek 2026-11-03):
 * the shop's attribute template takes the ones it has a field for (its
 * key, or its label as a slug, is the attribute's slug: `pa_renk` →
 * `renk`); the rest are reported with their values, for a template made
 * later. The run's side reads the same shape (workflows/migration/
 * attributes.ts `SourceAttribute`).
 */

export interface ProductAttribute {
  /** The export's own key: `pa_renk`, or a product's own `malzeme`. */
  key: string
  /** What a template's field is matched by: the key without `pa_`, as a URL slug (`renk`). */
  slug: string
  name: string
  /** The product's values, each once, in the shop's order. */
  values: string[]
}

/** A WooCommerce product as the common record, with its descriptive attributes. */
export interface WordpressProduct extends SourceProduct {
  attributes: ProductAttribute[]
}

// A product's own attribute is keyed by its name as WordPress slugs it: percent-encoded
function decoded(key: string): string {
  try {
    return decodeURIComponent(key)
  } catch {
    return key
  }
}

/** The slug a template's field is matched by: `pa_renk` → `renk`, `%c3%a7ap` → `cap`. */
export const attributeSlug = (key: string): string => toSlug(decoded(key).replace(/^pa_/i, ""))

/** The attributes the shop described the product with, but did not sell it by. */
export function descriptiveAttributes(attributes: readonly Attribute[]): ProductAttribute[] {
  return attributes
    .filter((attribute) => !attribute.variation && attribute.values.length > 0)
    .map((attribute) => ({
      key: attribute.key,
      slug: attributeSlug(attribute.key),
      name: attribute.name,
      values: [...new Set(attribute.values)],
    }))
    .filter((attribute) => attribute.slug !== "")
}
