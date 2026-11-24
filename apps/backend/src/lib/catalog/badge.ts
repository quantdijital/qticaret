import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../security/text"

/** A product's own card badge at most (as a reader counts them, not UTF-16 units). */
export const PRODUCT_BADGE_MAX = 24

// Invisible and direction-changing characters: a pill on a card has no use for them
const FORMAT_CHARACTER = /\p{Cf}/u

// Blank fillers that read as letters or symbols but draw nothing (Hangul fillers, the
// halfwidth one, the blank Braille cell): a badge of them is an empty pill
const BLANK_FILLER = /[ᅟᅠㅤﾠ⠀]/u

// Something a reader sees: a letter, a digit or a punctuation mark
const VISIBLE = /[\p{L}\p{N}\p{P}]/u

const GRAPHEMES = new Intl.Segmenter("tr", { granularity: "grapheme" })

/** Characters as a reader counts them: a letter with its accent is one. */
const lengthOf = (text: string): number => Array.from(GRAPHEMES.segment(text)).length

/** The badge as kept: spaces at either end cut, runs of spaces one; empty, none. */
export function normalizedBadge(text: string): string | null {
  const kept = text.trim().replace(/\s+/gu, " ")
  return kept === "" ? null : kept
}

/**
 * Whether a cut badge is one a card may show: clean text, no invisible or
 * blank filler character, something a reader sees. The save and the read
 * hold it to the same rule; the length is checked apart.
 */
export function isBadgeText(text: string): boolean {
  return (
    isCleanText(text) &&
    !FORMAT_CHARACTER.test(text) &&
    !BLANK_FILLER.test(text) &&
    VISIBLE.test(text)
  )
}

/**
 * The badge a save sends: one short line of clean text, cut at its ends
 * and its inner runs of spaces made one; empty clears it (null).
 */
export const productBadgeInput = z
  .string()
  .max(200)
  .transform(normalizedBadge)
  .refine((text) => text === null || isBadgeText(text), {
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
  return text !== null && lengthOf(text) <= PRODUCT_BADGE_MAX && isBadgeText(text) ? text : null
}
