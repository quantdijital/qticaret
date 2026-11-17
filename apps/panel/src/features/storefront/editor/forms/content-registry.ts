import {
  FEATURED_PRODUCT_SETTINGS,
  STRIP_GALLERY_SETTINGS,
  newsletterHasNote,
} from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { FieldGroupName, RegistryField } from "./field-registry"
import { scrollerFields, sliderFields } from "./shelf-registry"
import { kitDefaultsOf, turnsAsSlider } from "./slider-kit"

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
  | "slides"
  | "width"
  | "height"
  | "captions"
  | "strips_slant"
  | "strips_line"
  | "strips_overlap"
  | "strips_dim"
  | "open_first"
  | "single_open"
  | "gallery"
  | "strips_layout"
  | "show_note"
  | "joined"

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

/** The strip gallery's settings, open in "Diziliş" (`strip-gallery-groups.tsx`): five steps, two switches. */
function stripGalleryFields(section: AnySection): RegistryField[] {
  const G = `${E}.stripGallery`
  return (Object.keys(STRIP_GALLERY_SETTINGS) as (keyof typeof STRIP_GALLERY_SETTINGS)[]).map(
    (name) => {
      const switched = name === "strips_overlap" || name === "strips_dim"
      const steps: readonly string[] = STRIP_GALLERY_SETTINGS[name]
      return {
        ...entry(
          section,
          name,
          `${G}.${name}.label`,
          switched ? [] : steps.map((step) => `${G}.${name}.${step}`),
          "layout"
        ),
        term: `${G}.${name}.term`,
      }
    }
  )
}

/** The featured product's strips' look (`featured-groups.tsx`): three steps, two switches. */
function stripsFields(section: AnySection): RegistryField[] {
  const P = `${E}.featured`
  const steps = (field: "strips_layout" | "strips_slant" | "strips_line", key: string) =>
    entry(
      section,
      field,
      `${P}.${key}`,
      FEATURED_PRODUCT_SETTINGS[field].map((step) => `${P}.${key}s.${step}`),
      "layout"
    )
  return [
    steps("strips_layout", "stripsLayout"),
    steps("strips_slant", "stripsSlant"),
    steps("strips_line", "stripsLine"),
    entry(section, "strips_overlap", `${P}.stripsOverlap`, [], "layout"),
    entry(section, "strips_dim", `${P}.stripsDim`, [], "layout"),
  ]
}

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
            entry(section, "slides", `${C}.slides`),
            entry(section, "list_limit", `${C}.listLimit`, [], "categoryList"),
            entry(section, "show_count", `${C}.showCount`, [], "categoryList"),
            entry(section, "show_price", `${C}.showPrice`, [], "picks"),
            // Two or more slides turn on the slider's settings (adr/0049 Ek 2026-11-15)
            ...(turnsAsSlider(section)
              ? sliderFields(section.id, section, kitDefaultsOf(section))
              : []),
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
        entry(section, "thumbs", `${PB}.thumbs`, [], "thumbs"),
        ...(section.thumbs > 0
          ? [entry(section, "thumbs_count", `${PB}.thumbsCount`, [], "thumbs")]
          : []),
      ]
    case "hero_slider":
      return [
        entry(
          section,
          "slider_height",
          `${S}.height`,
          ["compact", "regular"].map((height) => `${S}.heights.${height}`),
          "options"
        ),
        // The scroller kit's settings it has use for (bilesen-denetimi (b) 4)
        ...sliderFields(section.id, section),
      ]
    case "faq":
      return [
        entry(section, "open_first", `${E}.faq.openFirst`, [], "opening"),
        entry(section, "single_open", `${E}.faq.singleOpen`, [], "opening"),
      ]
    case "featured_product":
      // Its photographs layout, open in "Diziliş" (adr/0049 Ek 2026-11-15); the strips' look
      // under it while they are chosen (Ek 2026-11-16)
      return [
        entry(
          section,
          "gallery",
          `${E}.featured.gallery`,
          FEATURED_PRODUCT_SETTINGS.gallery.map((step) => `${E}.featured.galleries.${step}`),
          "layout"
        ),
        ...(section.gallery === "strips" ? stripsFields(section) : []),
      ]
    // The promise line's switch, where the variant draws one (adr/0049 Ek 2026-11-17)
    case "newsletter":
      return newsletterHasNote(section.variant)
        ? [entry(section, "show_note", `${E}.newsletter.showNote`)]
        : []
    case "strip_gallery":
      return stripGalleryFields(section)
    // No count or switch in their content, or their own register (the band, the strip, the header)
    case "announcement_bar":
    case "banner":
    case "brands":
    case "category_main":
    case "footer_bar":
    case "header_bar":
    case "help":
    case "marquee":
    case "product_main":
    case "rich_text":
    case "trust_badges":
      return []
  }
}
