import type { AccentFont, StoreThemeSettings } from "@qticaret/types"
import { accentFontOf, handNoteOf } from "@qticaret/types/hand-note"
import type { HandNoteView } from "@qticaret/ui"

/**
 * The theme's accent face (sahip 2026-11-24, "el yazısı not";
 * `@qticaret/types/hand-note`): the handwriting face a section's hand note
 * is drawn in. `none`, the default, prints nothing and leaves the settings
 * as a backend before it sent them; the note then stands in the body face,
 * italic (the theme's own fallback).
 */

/** Each accent face's CSS variable (`app/fonts.css` sets it). */
export const ACCENT_FONT_VARIABLES: Readonly<Record<Exclude<AccentFont, "none">, string>> = {
  caveat: "--font-caveat",
  "dancing-script": "--font-dancing-script",
  kalam: "--font-kalam",
}

/**
 * The accent face as the settings hold it: a face on the list, or nothing
 * (`none`, absent, or a value this build does not know), so the defaults
 * read exactly as before it.
 */
export function accentOf(raw: unknown): Pick<StoreThemeSettings["typography"], "accent"> {
  const accent = accentFontOf(raw)
  return accent === "none" ? {} : { accent }
}

/**
 * A section's hand note as the theme draws it: its words trimmed, in the
 * accent face when `hand`; none (absent, null, empty) is null.
 */
export function handNoteView(note: unknown, hand: boolean): HandNoteView | null {
  const text = handNoteOf(note)
  return text === null ? null : { text, hand }
}

/** Whether a hand note is drawn in an accent face: the shop chose one. */
export const handFace = (settings: StoreThemeSettings): boolean =>
  (settings.typography.accent ?? "none") !== "none"

/**
 * `--font-accent` for the page's one style element, only while the shop
 * chose a face: the variable is what a hand note in that face reads, so
 * declaring it fetches nothing until a note is drawn.
 */
export function accentDeclarations(settings: StoreThemeSettings): string[] {
  const accent = settings.typography.accent ?? "none"
  return accent === "none" ? [] : [`--font-accent:var(${ACCENT_FONT_VARIABLES[accent]}), cursive`]
}
