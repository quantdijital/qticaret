import type { TFunction } from "i18next"
import type { CollapseOptions } from "@/components/patterns/collapsible-section"
import { summaryLine } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"

/**
 * The product page's folded parts (docs/06 "Ürün sayfası"), by their
 * element id: the SEO advisor's "go to field" lands on them and opens a
 * closed one (`revealSection`).
 */
export const PRODUCT_SECTIONS = {
  seo: "product-seo",
  attributes: "product-attributes",
  organize: "product-organize",
  shipping: "product-shipping",
  catalog: "product-catalog",
  variantImages: "product-variant-images",
  addons: "product-addons",
  priceHistory: "product-price-history",
  drafts: "product-drafts",
} as const

export type ProductSection = keyof typeof PRODUCT_SECTIONS

/** The barcode field of the first variant without one, in the variants card's codes view. */
export const VARIANT_CODES_TARGET = "product-variant-codes"

/**
 * Where each of the advisor's manual fixes takes the person on the
 * product's page: a main card by its anchor, or a folded section, which
 * opens first (`revealSection`).
 */
export const PRODUCT_TARGETS: Readonly<Record<string, string>> = {
  edit_title: PRODUCT_SECTIONS.seo,
  edit_description: PRODUCT_SECTIONS.seo,
  edit_robots: PRODUCT_SECTIONS.seo,
  edit_body: "product-description",
  edit_handle: "product-general",
  add_images: "product-media",
  add_alt_text: "product-media",
  edit_prices: "product-variants",
  // The codes view opens, the caret in the first missing barcode (`VariantsCard`)
  edit_codes: VARIANT_CODES_TARGET,
  edit_attributes: PRODUCT_SECTIONS.attributes,
  edit_brand: PRODUCT_SECTIONS.organize,
  edit_categories: PRODUCT_SECTIONS.organize,
  edit_dimensions: PRODUCT_SECTIONS.shipping,
}

/**
 * How one part folds: its line (what is in it, then what the advisor found
 * for it), remembered per person under `product.<part>`; an urgent finding
 * opens it, as does `attention` (an empty required field, a refused value).
 */
export function productFold(
  t: TFunction,
  section: ProductSection,
  findings: SectionFindings,
  parts: readonly (string | undefined)[],
  attention = false
): CollapseOptions {
  return {
    id: PRODUCT_SECTIONS[section],
    name: `product.${section}`,
    summary: summaryLine(t, parts, findings),
    attention: findings.attention || attention,
  }
}

/** A few names in a line, the rest counted ("Çakılar, Bıçaklar +2"). */
export function someNames(names: readonly string[], shown = 2): string {
  const rest = names.length - shown
  return rest > 0 ? `${names.slice(0, shown).join(", ")} +${String(rest)}` : names.join(", ")
}
