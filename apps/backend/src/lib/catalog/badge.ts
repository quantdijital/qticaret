import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../security/text"

/** A product's own card badge at most (as a reader counts them, not UTF-16 units). */
export const PRODUCT_BADGE_MAX = 24

// Invisible and direction-changing characters: a pill on a card has no use for them
const FORMAT_CHARACTER = /\p{Cf}/u

const GRAPHEMES = new Intl.Segmenter("tr", { granularity: "grapheme" })

/** Characters as a reader counts them: a letter with its accent is one. */
const lengthOf = (text: string): number => Array.from(GRAPHEMES.segment(text)).length

/** The badge as kept: spaces at either end cut, runs of spaces one; empty, none. */
export function normalizedBadge(text: string): string | null {
  const kept = text.trim().replace(/\s+/gu, " ")
  return kept === "" ? null : kept
}

/**
 * The badge a save sends: one short line of clean text, cut at its ends
 * and its inner runs of spaces made one; empty clears it (null).
 */
export const productBadgeInput = z
  .string()
  .max(200)
  .transform(normalizedBadge)
  .refine((text) => text === null || (isCleanText(text) && !FORMAT_CHARACTER.test(text)), {
    message: "catalog.badge_invalid",
  })
  .refine((text) => text === null || lengthOf(text) <= PRODUCT_BADGE_MAX, {
    message: "catalog.badge_too_long",
  })

/** A stored badge as a card may show it: none for anything that is not one. */
export function storedBadgeOf(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const text = normalizedBadge(value)
  return text !== null && lengthOf(text) <= PRODUCT_BADGE_MAX && isCleanText(text) ? text : null
}
