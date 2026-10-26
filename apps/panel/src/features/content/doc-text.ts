import type { JSONContent } from "@tiptap/react"

/** A document's text as one line, as the server reads it for a description (adr/0019). */
export function docText(doc: JSONContent | null | undefined): string {
  const parts: string[] = []
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.text) {
      parts.push(node.text)
    }
    node.content?.forEach(walk)
    // Blocks end with a space so words of two blocks do not join
    if (node.type !== "text") {
      parts.push(" ")
    }
  }
  if (doc) {
    walk(doc)
  }
  return parts.join("").replace(/\s+/g, " ").trim()
}
