import { STRIP_SOURCE_KINDS } from "@qticaret/types"
import type { StripSourceKind } from "@qticaret/types"
import type { StripItem, StripSource } from "@/features/storefront/api/layout"

/**
 * The strip gallery's items as the form changes them (adr/0049 Ek
 * 2026-11-16): a source's kind or record changed keeps the shop's own
 * picture, heading, line and link (the owner: the free fields always
 * stay); a record of another kind is chosen anew, and `custom` has none.
 */

export { STRIP_SOURCE_KINDS }

/** A new strip: a product to choose, nothing of the shop's own yet. */
export const newStripItem = (): StripItem => ({
  source: { kind: "product", target: "" },
  image: null,
  title: null,
  note: null,
  link: null,
})

/** The source of a kind: `custom` alone, a record's kind with its record kept only within the kind. */
export function sourceOf(kind: StripSourceKind, previous: StripSource): StripSource {
  if (kind === "custom") {
    return { kind }
  }
  const target = previous.kind === kind ? previous.target : ""
  return { kind, target }
}

/** The strip with its source's kind changed; its own picture, words and link stay. */
export const withKind = (item: StripItem, kind: StripSourceKind): StripItem => ({
  ...item,
  source: sourceOf(kind, item.source),
})

/** The strip with its record chosen; its own picture, words and link stay. */
export const withTarget = (item: StripItem, target: string): StripItem =>
  item.source.kind === "custom" ? item : { ...item, source: { kind: item.source.kind, target } }

/** The record the strip names; null for `custom` or none chosen yet. */
export const targetOf = (item: StripItem): string | null =>
  item.source.kind === "custom" || item.source.target === "" ? null : item.source.target
