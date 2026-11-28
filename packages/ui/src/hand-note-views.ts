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

/**
 * A section heading's two optional lines as a theme draws them (sahip
 * 2026-11-28): the small upper-case line over it and the hand note beside
 * it; each absent: not drawn. The product rail, the categories, the
 * departures, the reviews and the posts carry them.
 */
export interface HeadLinesView {
  /** A small upper-case line over the heading. */
  eyebrow?: string | null
  /** A short hand note beside the heading. */
  note?: HandNoteView
}
