import type { JSONContent } from "@tiptap/react"

/**
 * A product's plain description as the editor's document (ADR-0055), for a
 * product that has no document yet: each paragraph (text apart by a blank
 * line) a paragraph, a single line break in it a hard break. Saving it
 * unchanged is no change: the server's text of it is the same text.
 */
export function docOfDescription(text: string | null | undefined): JSONContent {
  const paragraphs = (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
    )
    .filter((lines) => lines.length > 0)
  return {
    type: "doc",
    content: paragraphs.map((lines) => ({
      type: "paragraph",
      content: lines.flatMap((line, index): JSONContent[] =>
        index === 0
          ? [{ type: "text", text: line }]
          : [{ type: "hardBreak" }, { type: "text", text: line }]
      ),
    })),
  }
}
