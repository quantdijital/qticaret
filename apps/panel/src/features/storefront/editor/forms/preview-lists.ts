import type { AnySection, ProductsSection } from "@/features/storefront/api/layout"

/**
 * The register's list rows (adr/0065 §9, Faz 2b; `preview-fields.ts`): a
 * field the preview names inside a repeated part (a question, a strip's
 * item, a band's slide, a badge, a price band, a columns rail's list, a
 * shelf's pill) by its place in the design, `items.2.answer`. Each part
 * of the key is matched against fixed words and a place the section has;
 * the answer is the field's own key, the forms' ids are made from it.
 */

const PLACE = /^(?:0|[1-9][0-9]?)$/

/** A place in a list as the key writes it (`2`), when the list has it; else null. */
export function placeOf(part: string | undefined, length: number): number | null {
  if (part === undefined || !PLACE.test(part)) {
    return null
  }
  const place = Number(part)
  return place < length ? place : null
}

/** A row's field: `<list>.<place>.<field>` with a place the list has and a field it shows. */
export function row(
  parts: readonly string[],
  list: string,
  length: number,
  fields: readonly string[]
): string | null {
  const [name, place, field, ...rest] = parts
  if (name !== list || field === undefined || rest.length > 0 || !fields.includes(field)) {
    return null
  }
  const at = placeOf(place, length)
  return at === null ? null : `${list}.${String(at)}.${field}`
}

/**
 * The key of a list row the section's form shows, as the form's ids take
 * it; null for any other. `badges`: the shared trust badges a strip's
 * form edits (their count).
 */
export function listField(
  section: AnySection,
  parts: readonly string[],
  badges: number
): string | null {
  if (section.type === "faq") {
    return row(parts, "items", section.items.length, ["question", "answer", "heading"])
  }
  if (section.type === "marquee") {
    return row(parts, "items", section.items.length, ["text", "subtext"])
  }
  // A figure's or a step's words (adr/0077 §10)
  if (section.type === "stats") {
    return row(parts, "items", section.items.length, ["value", "label", "text"])
  }
  if (section.type === "photo_collage") {
    return row(parts, "items", section.items.length, ["caption", "image", "link"])
  }
  if (section.type === "steps") {
    return row(parts, "items", section.items.length, ["title", "text"])
  }
  if (section.type === "banner") {
    return row(parts, "slides", section.slides.length, BANNER_PARTS)
  }
  if (section.type === "trust_badges") {
    return row(parts, "badges", badges, ["title", "text"])
  }
  if (section.type === "price_bands") {
    return row(parts, "bands", section.bands.length, ["label", "text"])
  }
  // A columns rail's more lists; the rail's own list is its `title`
  return section.type === "products" && section.variant === "columns"
    ? row(parts, "lists", section.lists?.length ?? 0, ["title"])
    : null
}

/** A band slide's fields the theme marks (`Campaign`). */
const BANNER_PARTS: readonly string[] = ["heading", "text", "image", "link", "second_link"]

/** A strip gallery strip's fields the theme marks (`StripGallery`); its dialog opens at them. */
export const STRIP_PARTS: readonly string[] = ["title", "note", "image"]

/**
 * A shelf's pill naming a rail beside it (`tabs.<place>.<count>`, the
 * theme's `tabKey`): that rail, when the panel's own shelf (`shelf`, the
 * rails joined with `section` in the page's order) starts at `section` and
 * counts as many as the page drew. Else null: a rail the storefront left
 * out (nothing on sale, out of its dates) would shift the places, so the
 * shelf's own form opens instead.
 */
export function tabRail(
  section: ProductsSection,
  parts: readonly string[],
  shelf: readonly ProductsSection[]
): ProductsSection | null {
  const [name, place, count, ...rest] = parts
  if (name !== "tabs" || rest.length > 0 || shelf[0]?.id !== section.id) {
    return null
  }
  const drawn = placeOf(count, 100)
  const at = drawn === shelf.length ? placeOf(place, shelf.length) : null
  return at !== null && at > 0 ? (shelf[at] ?? null) : null
}
