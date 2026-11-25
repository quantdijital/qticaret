import type { TFunction } from "i18next"
import type { CollapseOptions } from "@qticaret/admin-ui/patterns/collapsible-section"
import { summaryLine } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"

/**
 * The product page's parts beyond its main cards (docs/06 "Ürün
 * sayfası"), by their element id: the folded sections under the main
 * column (search appearance, attributes, add-ons, price history)
 * and the narrow column's cards (categories, catalog, parcel). The SEO
 * advisor's "go to field" lands on them and opens a closed section or a
 * card's dialog (`revealSection`).
 */
export const PRODUCT_SECTIONS = {
  seo: "product-seo",
  attributes: "product-attributes",
  organize: "product-organize",
  shipping: "product-shipping",
  catalog: "product-catalog",
  addons: "product-addons",
  priceHistory: "product-price-history",
  faq: "product-faq",
} as const

export type ProductSection = keyof typeof PRODUCT_SECTIONS

/** The gallery: the first picture without an alt text opens on its tile (`ImageGallery`). */
export const MEDIA_ALT_TARGET = "product-media-alt"

/** The barcode field: the first variant without one opens on it (its dialog's codes tab). */
export const VARIANT_CODES_TARGET = "product-variant-codes"

/**
 * Where each of the advisor's manual fixes takes the person on the
 * product's page: a main card by its anchor, a folded section, which
 * opens first, or a narrow column's card, whose dialog opens
 * (`revealSection`).
 */
export const PRODUCT_TARGETS: Readonly<Record<string, string>> = {
  edit_title: PRODUCT_SECTIONS.seo,
  edit_description: PRODUCT_SECTIONS.seo,
  edit_robots: PRODUCT_SECTIONS.seo,
  edit_body: "product-description",
  edit_handle: "product-general",
  // The short description, its own card under the long one
  edit_summary: "product-short-description",
  // adr/0078: a dated product's Program card (P-CONT-10)
  edit_program: "product-program",
  add_images: "product-media",
  add_alt_text: MEDIA_ALT_TARGET,
  // The first variant without a price opens (`VariantsCard`)
  edit_prices: "product-variants",
  // The first variant without a barcode opens on its codes, the caret in the barcode
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
