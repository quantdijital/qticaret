import { newsletterHasNote } from "@qticaret/types"
import type { AnySection, HeroSection, ProductsSection } from "@/features/storefront/api/layout"
import { slidesOf } from "./catalog-slides"
import { sliderControlField, turnsAsSlider } from "./slider-kit"
import { HEADER_CATALOG_GROUPS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { footerPreviewField } from "../footer-rows/footer-rows-fields"
import type { FooterPart } from "../footer-rows/footer-rows-fields"
import { STRIP_PARTS, listField, placeOf, row, tabRail } from "./preview-lists"

/**
 * The fields the live preview can point at (adr/0065 §9, Faz 2b): the
 * theme marks a section's words, buttons and picture with the design's
 * path to them (`heading`, `links.0`, `slides.2.heading`), and a pressed
 * edit label sends that key. This register is the panel's one answer to
 * it: a key it knows for that section becomes the element of the form to
 * open, scroll to and focus; any other key opens the section alone. The
 * key is never put in a selector nor shown: it is matched against this
 * list, part by part, and the forms take their elements' ids from here.
 */

/** Where a field the preview named sits in the section's panel. */
export interface PreviewField {
  /** The element to bring into view and focus (its id). */
  target: string
  /** The panel group it sits in: "İçerik", the catalog header's by the part of the bar. */
  group: FieldGroupName
  /** A slide's field: that slide's dialog opens at it. */
  slide?: number
  /** Another section's field (a shelf's pill names the rail beside it): that section opens. */
  section?: string
  /** A free rows footer's row or block (adr/0070 §6): its own panel opens. */
  part?: FooterPart
}

/** What the register reads beside the section: the document around it. */
export interface PreviewContext {
  /** A product rail's whole shelf on its page, itself among them (`shelfRun`). */
  shelf?: readonly ProductsSection[]
  /** How many trust badges the design has (a strip's form edits the shared list). */
  badges?: number
}

/** The elements' ids, shared by the forms and the preview's register. */
export const PREVIEW_IDS = {
  /** A section's own text, button, line or picture: `links.0` → `<section>-links-0`. */
  text: (sectionId: string, key: string) => `${sectionId}-${key.replaceAll(".", "-")}`,
  /** A field of the sliding opening's slide dialog (`slide-dialog.tsx`). */
  heroSlide: (slide: number, part: string) => `hero-slide-${String(slide)}-${part}`,
  /** A field of the catalogue opening's slide dialog (`catalog-slide-dialog.tsx`). */
  catalogSlide: (sectionId: string, slide: number, part: string) =>
    `${sectionId}-slide-${String(slide)}-${part}`,
  /** A catalog header's own field (`FIELD_IDS.header`, `header-catalog-fields.tsx`). */
  header: (sectionId: string, field: string) => `${sectionId}-header-${field}`,
} as const

/** The sections whose title the theme marks (`SectionHead` and their own headings). */
const TITLED: ReadonlySet<AnySection["type"]> = new Set([
  "products",
  "categories",
  "brands",
  "posts",
  "reviews",
  "google_rating",
  "price_bands",
  "related_products",
  "featured_product",
  "strip_gallery",
  "stats",
  "steps",
  "search_box",
  "photo_collage",
  "departures",
  "rich_text",
  "faq",
  "newsletter",
  "help",
])

/** The sections whose one line of text the theme marks (`text`). */
const TEXTED: ReadonlySet<AnySection["type"]> = new Set([
  "featured_product",
  "strip_gallery",
  "newsletter",
  "help",
])

/** The catalog header's fields the theme marks: its search box's words, its highlighted link, its strip's note. */
const HEADER_FIELDS: readonly string[] = ["search_placeholder", "highlight_link", "strip_note"]

const content = (target: string): PreviewField => ({ target, group: "content" })

/** A slide's part as the key names it, as its dialog's element suffix (`links.1` → `button-1`). */
function slidePart(parts: readonly string[], links: number, single: boolean): string | null {
  const [part, place, ...rest] = parts
  if (rest.length > 0) {
    return null
  }
  if (place === undefined) {
    return part === "heading" || part === "text" || part === "image" || part === "link"
      ? part
      : null
  }
  // The catalogue slide's two buttons; the sliding opening's slide has one link
  const at = part === "links" && !single ? placeOf(place, Math.min(links, 2)) : null
  return at === null ? null : `button-${String(at)}`
}

function heroField(section: HeroSection, parts: readonly string[]): PreviewField | null {
  const [first, second] = parts
  if (parts.length === 1 && first === "eyebrow") {
    return content(PREVIEW_IDS.text(section.id, "eyebrow"))
  }
  if (section.variant === "category_list") {
    const slides = slidesOf(section)
    // An opening drawn before slides names its own fields: its first slide in the editor
    const slide = first === "slides" ? placeOf(second, slides.length) : 0
    const own = first === "slides" ? parts.slice(2) : parts
    const saved = slide === null ? undefined : slides[slide]
    const part = saved && slide !== null ? slidePart(own, saved.links.length, false) : null
    return part !== null && slide !== null
      ? { ...content(PREVIEW_IDS.catalogSlide(section.id, slide, part)), slide }
      : null
  }
  if (parts.length === 1 && (first === "heading" || first === "text" || first === "image")) {
    return content(PREVIEW_IDS.text(section.id, first))
  }
  // The full image's accent line, a line of its heading (adr/0077 §9)
  if (parts.length === 1 && first === "title_accent" && section.variant === "full_image") {
    return content(PREVIEW_IDS.text(section.id, first))
  }
  const link =
    parts.length === 2 && first === "links" ? placeOf(second, section.links.length) : null
  // The opening's buttons stand in their own group, "Düğmeler"
  return link === null
    ? null
    : { target: PREVIEW_IDS.text(section.id, `links.${String(link)}`), group: "buttons" }
}

/**
 * The "see all" link the theme marks (`more`): a product rail's and the
 * categories', only while the shop has set its own (its field's element
 * stands in the form then; the theme's own fallback link is not marked).
 */
const ownMore = (section: AnySection): boolean =>
  (section.type === "products" || section.type === "categories") && Boolean(section.more)

/**
 * The newsletter box's own words the theme marks, while its form shows
 * their fields (adr/0049 Ek 2026-11-17): the line on the new variants,
 * the promise line while on, the card's picture.
 */
function newsletterShows(
  section: Extract<AnySection, { type: "newsletter" }>,
  word: string
): boolean {
  switch (word) {
    case "description":
      return section.variant !== "standard"
    case "note":
      return newsletterHasNote(section.variant) && section.show_note !== false
    case "image":
      return section.variant === "image_card"
    default:
      return false
  }
}

/** A field of one word (`title`, `text`, `body`, `more`, a catalog header's own). */
function wordField(section: AnySection, word: string): PreviewField | null {
  if (
    (word === "title" && TITLED.has(section.type)) ||
    (word === "text" && TEXTED.has(section.type)) ||
    (word === "body" && section.type === "rich_text") ||
    // The steps' intro and their one link (adr/0077 §10)
    (section.type === "steps" && (word === "intro" || word === "link")) ||
    (section.type === "search_box" && word === "intro") ||
    // The posts' intro panel's words and button, the split band's upper line (adr/0077 Ek)
    (section.type === "posts" &&
      section.variant === "intro_panel" &&
      (word === "eyebrow" || word === "intro" || word === "link")) ||
    (word === "eyebrow" && section.type === "banner" && section.variant === "split") ||
    (section.type === "photo_collage" && word === "intro") ||
    // Upcoming departures' intro (adr/0077 §10)
    (section.type === "departures" && word === "intro") ||
    // The picture beside the text (adr/0073 §3), while the variant shows its field
    (word === "image" && section.type === "rich_text" && section.variant === "with_image") ||
    (word === "more" && ownMore(section)) ||
    (section.type === "newsletter" && newsletterShows(section, word))
  ) {
    return content(PREVIEW_IDS.text(section.id, word))
  }
  return section.type === "header_bar" &&
    section.variant === "catalog" &&
    HEADER_FIELDS.includes(word)
    ? {
        target: PREVIEW_IDS.header(section.id, word),
        group: HEADER_CATALOG_GROUPS[word as keyof typeof HEADER_CATALOG_GROUPS],
      }
    : null
}

/**
 * The panel's place for a field the preview named in `section`; null for
 * a key it does not know there (the section's form opens without it).
 */
export function previewField(
  section: AnySection,
  key: string,
  context: PreviewContext = {}
): PreviewField | null {
  if (key.length > 80) {
    return null
  }
  const parts = key.split(".")
  const [first, second] = parts
  // A slider's arrows, dots and pause button: their settings in its panel
  if (first === "scroller") {
    return turnsAsSlider(section) ? sliderControlField(section, parts) : null
  }
  if (section.type === "hero") {
    return heroField(section, parts)
  }
  if (section.type === "footer_bar" && section.variant === "free_rows") {
    return footerPreviewField(section, parts)
  }
  if (section.type === "hero_slider") {
    const slide = first === "slides" ? placeOf(second, section.slides.length) : null
    const part = slide === null ? null : slidePart(parts.slice(2), 0, true)
    return part !== null && slide !== null
      ? { ...content(PREVIEW_IDS.heroSlide(slide, part)), slide }
      : null
  }
  if (section.type === "strip_gallery" && first === "items") {
    // A strip's words and picture: its dialog opens at the field
    const field = row(parts, "items", section.items.length, STRIP_PARTS)
    const strip = placeOf(second, section.items.length)
    return field === null || strip === null
      ? null
      : { ...content(PREVIEW_IDS.text(section.id, field)), slide: strip }
  }
  if (section.type === "announcement_bar") {
    const line =
      parts.length === 2 && first === "lines" ? placeOf(second, section.lines.length) : null
    return line === null ? null : content(PREVIEW_IDS.text(section.id, `lines.${String(line)}`))
  }
  if (section.type === "products" && first === "tabs") {
    const rail = tabRail(section, parts, context.shelf ?? [])
    return rail ? { ...content(PREVIEW_IDS.text(rail.id, "title")), section: rail.id } : null
  }
  if (parts.length === 1 && first !== undefined) {
    return wordField(section, first)
  }
  const field = listField(section, parts, context.badges ?? 0)
  return field === null ? null : content(PREVIEW_IDS.text(section.id, field))
}
