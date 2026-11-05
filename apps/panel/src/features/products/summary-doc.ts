import type { JSONContent } from "@tiptap/react"

/**
 * A product's short description (ADR-0055 Ek 2026-11-06): what the shop
 * writes to introduce the product, shown as written under its name, above
 * the price. The server takes at most this many characters of text, line
 * breaks and blocks not counted; the editor counts the same.
 */
export const SUMMARY_TEXT_MAX = 1_500

/** An empty short description, as the editor opens one. */
export const EMPTY_SUMMARY: JSONContent = { type: "doc", content: [] }

/** Characters of a document's text, as the server's cap counts them. */
export function docTextLength(doc: JSONContent | null | undefined): number {
  if (!doc) {
    return 0
  }
  const own = doc.type === "text" ? (doc.text?.length ?? 0) : 0
  return own + (doc.content ?? []).reduce((sum, child) => sum + docTextLength(child), 0)
}

/** Whether a document says anything (an editor's empty paragraph, or spaces, does not). */
export function hasSummaryText(doc: JSONContent | null | undefined): boolean {
  const walk = (node: JSONContent): boolean =>
    (node.type === "text" && (node.text ?? "").trim() !== "") || (node.content ?? []).some(walk)
  return doc ? walk(doc) : false
}
