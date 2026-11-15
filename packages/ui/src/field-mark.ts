/**
 * The field mark (adr/0065 §9, Faz 2b): in the theme editor's live preview
 * the element drawing one of a section's texts or pictures carries
 * `data-qf="<field key>"`, the design's own path to it (`heading`,
 * `links.0`, `slides.2.heading`). Pointing at it shows a small "edit"
 * label; pressing that opens the section's form at the field.
 *
 * Unlike the section mark it is never on a live page: a view carries
 * `editor: true` only when the request is the editor's live session, and
 * `fieldMark` writes nothing otherwise. So a published page, and the
 * preset lock's HTML, stay as they are. The contract a theme keeps:
 *
 * - the mark sits on the element showing the text (or the picture's box),
 *   inside its section's `data-qs` element;
 * - the key is the design's path, lowercase words and numbers joined by
 *   dots; a repeated part (a slide, a button, a line) takes its place in
 *   the design, not in the drawing.
 */
export const FIELD_MARK = "data-qf"

/** The attribute to spread on a field's element: only in the editor's preview (`on`). */
export function fieldMark(on: boolean | undefined, key: string): { "data-qf"?: string } {
  return on ? { "data-qf": key } : {}
}

/** A field's key from its parts: `fieldKey("slides", 2, "heading")` is `slides.2.heading`. */
export const fieldKey = (...parts: readonly (string | number)[]): string =>
  parts.map(String).join(".")
