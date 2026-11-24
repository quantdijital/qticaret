import { optional, text } from "../layout-fields"

/**
 * A section's hand note (sahip 2026-11-24, "el yazısı not"): a short line
 * of plain text over the heading of the full image opening and the split
 * band, drawn in the theme's accent face (`typography.accent`) or, with
 * none chosen, the theme's own face in italics. Plain text, no shop
 * tokens: trimmed, within `HAND_NOTE_MAX`, no control character
 * (`text`, `isCleanText`). Optional; none draws nothing, so a
 * section saved before it reads and draws unchanged.
 *
 * Mirrors `@qticaret/types`' `HAND_NOTE_MAX` (`hand-note.ts`); a unit
 * test keeps them equal.
 */
export const HAND_NOTE_MAX = 60

export const handNote = optional(text(HAND_NOTE_MAX))
