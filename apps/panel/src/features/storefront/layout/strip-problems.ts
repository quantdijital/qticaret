import { STRIP_GALLERY_LIMITS } from "@qticaret/types"
import type { StripRecordKind } from "@qticaret/types"
import type { StripGallerySection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { Problem } from "./problems"
import { linkProblem, textProblem } from "./problems"

/**
 * What the server would refuse in the strip gallery (adr/0049 Ek
 * 2026-11-16), found before the save, by field: two strips at least, a
 * `custom` strip's picture, a source's chosen record, the shop's own
 * words and links.
 */

type Found = [string, Problem | null]

/** The problem of a source with no record chosen yet, by its kind. */
export const RECORD_REQUIRED: Readonly<Record<StripRecordKind, Problem>> = {
  product: "productRequired",
  category: "categoryRequired",
  collection: "collectionRequired",
  brand: "brandRequired",
}

export function stripGalleryProblems(section: StripGallerySection): Found[] {
  return [
    ["title", textProblem(section.title, L.title)],
    ["text", textProblem(section.text, STRIP_GALLERY_LIMITS.text, true)],
    ["items", section.items.length < STRIP_GALLERY_LIMITS.items.min ? "stripsTwo" : null],
    ...section.items.flatMap((item, index): Found[] => {
      const at = `items.${String(index)}`
      const { source } = item
      return [
        [
          `${at}.source`,
          source.kind !== "custom" && source.target === "" ? RECORD_REQUIRED[source.kind] : null,
        ],
        [
          `${at}.image`,
          source.kind === "custom" && item.image === null
            ? "imageRequired"
            : textProblem(item.image?.alt ?? null, L.alt),
        ],
        [`${at}.title`, textProblem(item.title, STRIP_GALLERY_LIMITS.title, true)],
        [`${at}.note`, textProblem(item.note, STRIP_GALLERY_LIMITS.note, true)],
        [`${at}.link`, linkProblem(item.link)],
      ]
    }),
  ]
}
