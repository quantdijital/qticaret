import type { AnySection } from "@/features/storefront/api/layout"
import type { FieldGroupName, RegistryField } from "./field-registry"
import { scrollerFields, sliderFields } from "./shelf-registry"

/**
 * The content fields the settings search finds (docs/tema/bilesen-standardi
 * §5.5, denetim O2), beside `field-registry.ts`'s: how many a list shows,
 * a rail's columns, the counts and switches inside a section's content,
 * the sliding opening's options. Built from what the forms show as they
 * stand (the seconds only while the slides turn by themselves, a count
 * only while its switch is on); the forms take their elements' ids from
 * `CONTENT_IDS`, so a search lands on the field it names.
 */

export type ContentField =
  | "limit"
  | "columns"
  | "columns_mobile"
  | "card_variant"
  | "show_count"
  | "list_limit"
  | "show_price"
  | "excerpts"
  | "excerpt_count"
  | "profile_link"
  | "thumbs"
  | "thumbs_count"
  | "slider_height"
  | "open_first"
  | "single_open"

/** The content fields' elements' ids (spread into `FIELD_IDS`). */
export const CONTENT_IDS = {
  content: (sectionId: string, field: ContentField) => `${sectionId}-content-${field}`,
} as const

const E = "storefront.editor"
const F = `${E}.fields`
const S = `${E}.slider`
const G = `${E}.googleRating`
const C = `${E}.heroCatalog`
const PB = `${E}.priceBands`

/** One entry: its label and term keys (`<label>Term` beside a flat label), its steps' names. */
const entry = (
  section: AnySection,
  field: ContentField,
  label: string,
  options: readonly string[] = [],
  group: FieldGroupName = "content"
): RegistryField => ({
  key: field,
  group,
  label,
  term: `${label}Term`,
  options,
  target: CONTENT_IDS.content(section.id, field),
})

/** The content fields the section's form shows as it stands, in the form's order. */
export function contentFields(section: AnySection): RegistryField[] {
  const limit = (s: AnySection) => entry(s, "limit", `${F}.limit`)
  switch (section.type) {
    case "products":
      // A grid's or a carousel's count; the other variants' are fixed
      return section.variant === "grid" || section.variant === "carousel" ? [limit(section)] : []
    case "posts":
    case "reviews":
      return [limit(section)]
    case "related_products":
      // As a rail's (bilesen-denetimi (b) 7): a grid's columns, the card, a carousel's scroller
      return [
        limit(section),
        ...(section.variant === "carousel"
          ? []
          : [
              entry(section, "columns", `${F}.columns`, [], "layout"),
              entry(section, "columns_mobile", `${F}.columnsMobile`, [], "layout"),
            ]),
        {
          ...entry(section, "card_variant", `${E}.products.cardVariant`, [], "layout"),
          term: `${E}.products.cardVariantTerm`,
        },
        ...(section.variant === "carousel" ? scrollerFields(section.id, section.scroller) : []),
      ]
    case "categories":
      return [entry(section, "show_count", `${E}.categories.showCount`)]
    case "hero":
      return section.variant === "category_list"
        ? [
            entry(section, "list_limit", `${C}.listLimit`),
            entry(section, "show_count", `${C}.showCount`),
            entry(section, "show_price", `${C}.showPrice`),
          ]
        : []
    case "google_rating":
      return [
        entry(section, "excerpts", `${G}.excerpts`),
        ...(section.excerpts > 0 ? [entry(section, "excerpt_count", `${G}.count`)] : []),
        entry(section, "profile_link", `${G}.profileLink`),
      ]
    case "price_bands":
      return [
        entry(section, "thumbs", `${PB}.thumbs`),
        ...(section.thumbs > 0 ? [entry(section, "thumbs_count", `${PB}.thumbsCount`)] : []),
      ]
    case "hero_slider":
      return [
        entry(
          section,
          "slider_height",
          `${S}.height`,
          ["compact", "regular"].map((height) => `${S}.heights.${height}`)
        ),
        // The scroller kit's settings it has use for (bilesen-denetimi (b) 4)
        ...sliderFields(section.id, section),
      ]
    case "faq":
      return [
        entry(section, "open_first", `${E}.faq.openFirst`),
        entry(section, "single_open", `${E}.faq.singleOpen`),
      ]
    // No count or switch in their content, or their own register (the band, the strip, the header)
    case "announcement_bar":
    case "banner":
    case "brands":
    case "category_main":
    case "featured_product":
    case "footer_bar":
    case "header_bar":
    case "help":
    case "marquee":
    case "newsletter":
    case "product_main":
    case "rich_text":
    case "trust_badges":
      return []
  }
}
