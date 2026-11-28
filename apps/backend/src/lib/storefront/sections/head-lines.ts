import { shopText, text } from "../layout-fields"
import { HAND_NOTE_MAX } from "./hand-note"

/**
 * A section heading's two optional lines (sahip 2026-11-28): the small
 * upper-case line over it (`eyebrow`, shop tokens filled) and the hand
 * note beside it (`note`, plain text, `hand-note.ts`). Shared by the
 * product rail, the categories, the departures and the reviews (the posts
 * keep their own eyebrow, 40 characters, and take the note). Optional and
 * absent until written (no default, as the figures strip's eyebrow and
 * note), so a section saved before them reads, stores and draws unchanged.
 *
 * Mirrors `@qticaret/types`' `SECTION_EYEBROW_MAX`
 * (`section-head-lines.ts`); a unit test keeps them equal.
 */
export const SECTION_EYEBROW_MAX = 60

/** The hand note as a heading line: plain text within its length; absent: none. */
export const headNote = text(HAND_NOTE_MAX).nullable().optional()

/** The two lines' fields for a section's schema. */
export const headLines = {
  eyebrow: shopText(SECTION_EYEBROW_MAX).nullable().optional(),
  note: headNote,
}

/**
 * The two lines as the store API prints them: each only once written, so
 * a section from before them prints as it did. The eyebrow's shop tokens
 * filled; the note is plain text.
 */
export function printedHeadLines(
  section: { eyebrow?: string | null; note?: string | null },
  fill: (text: string | null) => string | null
): { eyebrow?: string; note?: string } {
  const eyebrow = section.eyebrow ? fill(section.eyebrow) : null
  return {
    ...(eyebrow ? { eyebrow } : {}),
    ...(section.note ? { note: section.note } : {}),
  }
}
