/**
 * A section heading's two optional lines (sahip 2026-11-28): the small
 * upper-case line over it (`eyebrow`, "POPÜLER ROTALAR", as the figures
 * strip and the photo collage have) and the hand note beside it (`note`,
 * `hand-note.ts`). Shared by the product rail, the categories, the
 * departures, the reviews and the posts; each printed by the store API
 * only once written, so a section saved before them reads and draws as it
 * did. Empty or absent: not drawn. The backend mirrors the length
 * (`sections/head-lines.ts`; a test keeps them equal). The posts keep the
 * eyebrow they had (`POSTS_INTRO_LIMITS.eyebrow`, 40 characters).
 */

/** An eyebrow's most characters: a few words. */
export const SECTION_EYEBROW_MAX = 60

/** The two lines as the store API prints them on a section; absent: none. */
export interface StoreHeadLines {
  /** A small upper-case line over the heading. */
  eyebrow?: string | null | undefined
  /** A short hand note beside the heading (`HAND_NOTE_MAX`). */
  note?: string | null | undefined
}
