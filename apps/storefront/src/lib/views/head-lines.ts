import type { HomeSectionView } from "@qticaret/ui"
import { handNoteView } from "./accent"
import { noteInHand } from "./theme-settings"

/** The sections whose heading may carry an upper line and a hand note (sahip 2026-11-28). */
const HEAD_LINED: ReadonlySet<string> = new Set([
  "products",
  "categories",
  "departures",
  "reviews",
  "posts",
])

/**
 * A section's view with its heading's two lines (`HeadLinesView`): the
 * upper line as the backend filled it, the hand note in the shop's accent
 * face when it chose one (the face read only for a section with a note).
 * Each only once written, so a view without them is the one it was; any
 * other section's view is returned as it came.
 */
export async function withHeadLines<V extends HomeSectionView>(
  view: V,
  section: { type: string; eyebrow?: unknown; note?: unknown }
): Promise<V> {
  if (!HEAD_LINED.has(view.type)) {
    return view
  }
  const eyebrow =
    typeof section.eyebrow === "string" && section.eyebrow.trim() !== ""
      ? section.eyebrow.trim()
      : null
  const note = handNoteView(section.note, section.note ? await noteInHand(section.note) : false)
  if (!eyebrow && !note) {
    return view
  }
  return { ...view, ...(eyebrow ? { eyebrow } : {}), ...(note ? { note } : {}) }
}
