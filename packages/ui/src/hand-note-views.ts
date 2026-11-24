/**
 * A section's hand note as a theme draws it (sahip 2026-11-24, "el yazısı
 * not"): a short line of the shop's own over the heading, small and tilted
 * like a note written on the page. Real text, read by a screen reader as
 * any line; kept readable on its ground (the theme's own inks).
 */
export interface HandNoteView {
  /** The shop's words, trimmed; never empty. */
  text: string
  /**
   * The shop chose an accent face (`typography.accent`): the note is drawn
   * in it (`--font-accent`). False: in the theme's own face, italic.
   */
  hand: boolean
}
