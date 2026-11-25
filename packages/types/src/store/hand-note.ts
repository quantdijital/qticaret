/**
 * The hand note (sahip 2026-11-24, "el yazısı not"): a short line of the
 * shop's own over a section's heading, drawn small and tilted like a note
 * written on the page ("Sizi bekliyoruz!"). Two halves, each optional:
 *
 * - the theme's accent face (`StoreThemeSettings.typography.accent`): one
 *   of a few self-hosted handwriting faces, or `none` (the default);
 * - a section's `note` (the full image opening, the split band): the line
 *   itself, plain text, at most `HAND_NOTE_MAX` characters.
 *
 * With the face off a note still shows, in the theme's own face set in
 * italics; with no note nothing is drawn and no face is fetched. The
 * backend mirrors the list and the length (`theme-steps.ts`,
 * `sections/hand-note.ts`; a test keeps them equal). Imports nothing at
 * run time.
 */

/**
 * The accent faces a shop may choose, `none` first: handwriting faces, then
 * serif display faces (drawn italic in a mixed heading, `title_mix`), each
 * carrying every Turkish letter, OFL 1.1, served from the storefront's own
 * origin (`app/fonts.css`), never a font host.
 */
export const ACCENT_FONTS = [
  "none",
  "caveat",
  "dancing-script",
  "kalam",
  "dm-serif",
  "fraunces",
  "playfair",
] as const
export type AccentFont = (typeof ACCENT_FONTS)[number]

/** A note's most characters: a few words, never a paragraph. */
export const HAND_NOTE_MAX = 60

/** The accent face as a reader takes it: one this build does not know, or none, is `none`. */
export function accentFontOf(value: unknown): AccentFont {
  const listed: readonly unknown[] = ACCENT_FONTS
  return listed.includes(value) ? (value as AccentFont) : "none"
}

/** A section's note as a reader takes it: its words trimmed; none, empty or not text is null. */
export function handNoteOf(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const note = value.trim()
  return note === "" ? null : note
}
