import {
  FEATURED_PRODUCT_SETTINGS,
  PHOTO_COLLAGE_SETTINGS,
  REVIEWS_PRODUCT_IMAGES,
  RICH_TEXT_IMAGE_SIDES,
  STATS_SETTINGS,
  STEPS_SETTINGS,
  DEPARTURES_SETTINGS,
  STRIP_GALLERY_SETTINGS,
  TOP_SLIDER_SETTINGS,
  TOP_SLIDER_SETTING_NAMES,
  newsletterHasNote,
} from "@qticaret/types"
import type { TopSliderSetting } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { FieldGroupName, RegistryField } from "./field-registry"
import { heroFullFields } from "./hero-full-registry"
import { iconFields } from "./icon-registry"
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
  | "news_tone"
  | "news_consent"
  | "image_side"
  | "outline"
  | "questions"
  | "form"
  | "imprint"
  | "dividers"
  | "stats_arrangement"
  | "stats_social"
  | "steps_layout"
  | "numbers"
  | "steps_connector"
  | "show_icons"
  | "stats_style"
  | "lift"
  | "disc"
  | "icons_phone"
  | "icons_row_style"
  | "collage_layout"
  | "collage_phone"
  | "collage_card"
  | "collage_height"
  | "reviews_product_image"
  | "departures_layout"
  | "action"
  | "search_position"
  | "show_trust"
  | "video_url"
  | "video_label"
  | "align"
  | "scrim"
  | "edge"
  | "button_tone"
  | "button_icon"
  | "accent_mark"
  | "ornament"
  | "second_button"
  | "title_style"
  | "trust_place"
  | "note_place"
  | "title_mix"
  | "words_place"

/** The content fields' elements' ids (spread into `FIELD_IDS`). */
export const CONTENT_IDS = {
  content: (sectionId: string, field: ContentField) => `${sectionId}-content-${field}`,
} as const

const E = "storefront.editor"
const F = `${E}.fields`
const S = `${E}.slider`
const C = `${E}.heroCatalog`
const PB = `${E}.priceBands`

/** One entry: its label and term keys (`<label>Term` beside a flat label), its steps' names. */
const T = "storefront.editor.topSlider"

/** Where the top image slider's settings stand in its "Stil" tab (`top-slider-groups.tsx`). */
const TOP_SLIDER_GROUPS: Readonly<Record<TopSliderSetting, FieldGroupName>> = {
  height: "layout",
  interval: "motion",
  transition: "motion",
  arrows: "controls",
  dots: "controls",
}

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

/** The steps' settings drawn as steps (`points-groups.tsx`), by setting and field name. */
export const STEPS_FIELDS = [
  ["layout", "steps_layout"],
  ["numbers", "numbers"],
  ["connector", "steps_connector"],
] as const satisfies readonly (readonly [keyof typeof STEPS_SETTINGS, ContentField])[]

/** The figures strip's switch and the steps' two steps, open in "Diziliş" (adr/0077 §10). */
function pointsFields(section: AnySection): RegistryField[] {
  if (section.type === "stats") {
    const D = `${E}.stats.dividers`
    const I = `${E}.stats.item_style`
    return [
      {
        ...entry(
          section,
          "stats_style",
          `${I}.label`,
          STATS_SETTINGS.item_style.map((step) => `${I}.${step}`),
          "layout"
        ),
        term: `${I}.term`,
      },
      { ...entry(section, "dividers", `${D}.label`, [], "layout"), term: `${D}.term` },
    ]
  }
  return STEPS_FIELDS.map(([name, field]) => {
    const P = `${E}.steps.${name}`
    const steps: readonly string[] = STEPS_SETTINGS[name]
    return {
      ...entry(
        section,
        field,
        `${P}.label`,
        steps.map((step) => `${P}.${step}`),
        "layout"
      ),
      term: `${P}.term`,
    }
  })
}

/** The collage's steps by setting and field name, open in "Diziliş" (`collage-groups.tsx`). */
export const COLLAGE_FIELDS = [
  ["layout", "collage_layout"],
  ["phone", "collage_phone"],
  ["card", "collage_card"],
  ["height", "collage_height"],
] as const satisfies readonly (readonly [keyof typeof PHOTO_COLLAGE_SETTINGS, ContentField])[]

/** The photo collage's layout from 1024 px and on a phone (adr/0077 §10). */
function collageFields(section: AnySection): RegistryField[] {
  return COLLAGE_FIELDS.map(([name, field]) => {
    const P = `${E}.photoCollage.${name}`
    const steps: readonly string[] = PHOTO_COLLAGE_SETTINGS[name]
    return {
      ...entry(
        section,
        field,
        `${P}.label`,
        steps.map((step) => `${P}.${step}`),
        "layout"
      ),
      term: `${P}.term`,
    }
  })
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
      return [limit(section)]
    // A carousel's scroller beside the count (adr/0077 §10)
    case "reviews":
      return [
        limit(section),
        ...(section.variant === "carousel"
          ? [
              // The product's picture on each card (adr/0077 §10 Ek), open in "Diziliş"
              {
                ...entry(
                  section,
                  "reviews_product_image",
                  `${E}.reviewsCard.productImage.label`,
                  REVIEWS_PRODUCT_IMAGES.map((step) => `${E}.reviewsCard.productImage.${step}`),
                  "layout"
                ),
                term: `${E}.reviewsCard.productImage.term`,
              },
              ...scrollerFields(section.id, section.scroller),
            ]
          : []),
      ]
    case "photo_collage":
      return collageFields(section)
    // adr/0078: the steps are the product's; the section has only its title and variant
    case "program":
      return []
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
      return [
        entry(section, "show_count", `${E}.categories.showCount`),
        ...iconFields(section, CONTENT_IDS.content),
      ]
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
        : heroFullFields(section, CONTENT_IDS.content)
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
    case "stats":
    case "steps":
      return [...pointsFields(section), ...iconFields(section, CONTENT_IDS.content)]
    // The count in the content; the list or cards in "Diziliş" (adr/0077 §10)
    case "departures":
      return [
        { ...limit(section), term: `${E}.departures.limitTerm` },
        {
          ...entry(
            section,
            "departures_layout",
            `${E}.departures.layout.label`,
            DEPARTURES_SETTINGS.layout.map((step) => `${E}.departures.layout.${step}`),
            "layout"
          ),
          term: `${E}.departures.layout.term`,
        },
      ]
    // The box's fields are the theme's (adr/0077 §1), not the section's
    case "search_box":
      return []
    // The picture's side beside the text, while the variant has one (adr/0073 §3)
    case "rich_text":
      return section.variant === "with_image"
        ? [
            entry(
              section,
              "image_side",
              `${E}.richText.imageSide`,
              RICH_TEXT_IMAGE_SIDES.map((side) => `${E}.richText.imageSides.${side}`)
            ),
          ]
        : section.variant === "article"
          ? [
              entry(section, "outline", `${E}.pageText.outline`),
              entry(section, "questions", `${E}.pageText.questions`),
            ]
          : []
    // A content page's contact section: its form and imprint switches (adr/0073 Ek 2026-11-19 (2) K2)
    case "contact":
      return [
        entry(section, "form", `${E}.pageText.form`),
        entry(section, "imprint", `${E}.pageText.imprint`),
      ]
    // The card's lift (adr/0077 §10 Ek); the strip and the lined boxes have none
    case "trust_badges":
      return iconFields(section, CONTENT_IDS.content)
    // The top image slider's steps and switches (owner 2026-11-27), in its form
    case "top_slider":
      return TOP_SLIDER_SETTING_NAMES.map((name) => {
        const steps: readonly string[] = TOP_SLIDER_SETTINGS[name]
        return {
          key: `top_slider.${name}`,
          group: TOP_SLIDER_GROUPS[name],
          label: `${T}.${name}.label`,
          term: `${T}.${name}.term`,
          options: steps.map((step) => `${T}.${name}.${step}`),
          target: `${section.id}-top-slider-${name}`,
        }
      })
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
    case "payment_facts":
    case "shipping_facts":
      return []
  }
}
