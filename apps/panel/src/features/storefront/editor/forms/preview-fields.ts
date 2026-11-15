import type { AnySection, HeroSection } from "@/features/storefront/api/layout"
import { slidesOf } from "./catalog-slides"

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
  /** Every such field sits in the open "İçerik" group. */
  group: "content"
  /** A slide's field: that slide's dialog opens at it. */
  slide?: number
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
} as const

/** The sections whose title the theme marks (`SectionHead`). */
const TITLED: ReadonlySet<AnySection["type"]> = new Set([
  "products",
  "categories",
  "brands",
  "posts",
  "reviews",
  "google_rating",
  "price_bands",
])

const PLACE = /^(?:0|[1-9][0-9]?)$/

/** A place in a list as the key writes it (`2`), when the list has it; else null. */
function placeOf(part: string | undefined, length: number): number | null {
  if (part === undefined || !PLACE.test(part)) {
    return null
  }
  const place = Number(part)
  return place < length ? place : null
}

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
  const link =
    parts.length === 2 && first === "links" ? placeOf(second, section.links.length) : null
  return link === null ? null : content(PREVIEW_IDS.text(section.id, `links.${String(link)}`))
}

/**
 * The panel's place for a field the preview named in `section`; null for
 * a key it does not know there (the section's form opens without it).
 */
export function previewField(section: AnySection, key: string): PreviewField | null {
  if (key.length > 80) {
    return null
  }
  const parts = key.split(".")
  const [first, second] = parts
  if (section.type === "hero") {
    return heroField(section, parts)
  }
  if (section.type === "hero_slider") {
    const slide = first === "slides" ? placeOf(second, section.slides.length) : null
    const part = slide === null ? null : slidePart(parts.slice(2), 0, true)
    return part !== null && slide !== null
      ? { ...content(PREVIEW_IDS.heroSlide(slide, part)), slide }
      : null
  }
  if (section.type === "announcement_bar") {
    const line =
      parts.length === 2 && first === "lines" ? placeOf(second, section.lines.length) : null
    return line === null ? null : content(PREVIEW_IDS.text(section.id, `lines.${String(line)}`))
  }
  return parts.length === 1 && first === "title" && TITLED.has(section.type)
    ? content(PREVIEW_IDS.text(section.id, "title"))
    : null
}
