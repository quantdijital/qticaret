import { MEDIA_ALT_TARGET, PRODUCT_SECTIONS, VARIANT_CODES_TARGET } from "../detail/sections"
import type { PartKey } from "./parts"

/**
 * The product page's key fields in the command menu's "Alana git" (⌘K),
 * besides its sections: each in its part, gone to as the advisor's "Alana
 * git" goes (`target`; a folded part opens, a side card turns into its
 * form), then the caret put in `focus` when the field is drawn.
 */
export interface FieldEntry {
  key: string
  part: PartKey
  target: string
  focus?: string
  /** Other words it is found by. */
  keywords?: readonly string[]
}

export const FIELD_ENTRIES: readonly FieldEntry[] = [
  {
    key: "title",
    part: "general",
    target: "product-general",
    focus: "#detail-title",
    keywords: ["ad", "isim"],
  },
  {
    key: "handle",
    part: "general",
    target: "product-general",
    focus: "#detail-handle",
    keywords: ["url", "slug"],
  },
  // One variant: the caret in its price in the card; several: the first without a price opens
  {
    key: "price",
    part: "data",
    target: "product-variants",
    focus: "#single-price",
    keywords: ["fiyat", "stok"],
  },
  { key: "barcode", part: "data", target: VARIANT_CODES_TARGET, keywords: ["gtin", "sku"] },
  { key: "altText", part: "media", target: MEDIA_ALT_TARGET, keywords: ["görsel"] },
  {
    key: "seoTitle",
    part: "seo",
    target: PRODUCT_SECTIONS.seo,
    focus: `#${PRODUCT_SECTIONS.seo} input`,
    keywords: ["meta", "seo"],
  },
  { key: "categories", part: "organize", target: PRODUCT_SECTIONS.organize, keywords: ["marka"] },
  { key: "weight", part: "shipping", target: PRODUCT_SECTIONS.shipping, keywords: ["desi"] },
]

/** The fields offered: those in a part the page draws now. */
export const fieldsShown = (drawn: (key: PartKey) => boolean): FieldEntry[] =>
  FIELD_ENTRIES.filter((entry) => drawn(entry.part))
