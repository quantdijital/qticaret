import type { Block, ContentDoc, Inline, ListItem, TableRow } from "./doc"

/**
 * A document as plain text (adr/0055): what a product's `description`
 * holds beside its document, for the meta description, JSON-LD, feeds,
 * search and the catalog sheet. Each heading, paragraph, list, quote and
 * table is a block, blocks apart by a blank line; a list's items are one
 * line each (a nested list's items under their own), a table's rows one
 * line each with their cells joined by " · ". A line break in a paragraph
 * stays one. Pictures and cards say nothing. The text is cut at a block
 * within `max` (a first block longer than that at a word).
 */

export const CELL_SEPARATOR = " · "

const lines = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")

const inlineText = (content: readonly Inline[] | undefined): string =>
  lines((content ?? []).map((node) => (node.type === "text" ? node.text : "\n")).join(""))

function itemLines(items: readonly ListItem[]): string[] {
  return items.flatMap((item) =>
    item.content.flatMap((child) =>
      child.type === "paragraph"
        ? [inlineText(child.content).replace(/\n/g, " ")]
        : itemLines(child.content)
    )
  )
}

const rowLine = (row: TableRow): string =>
  row.content
    .map((cell) =>
      cell.content
        .map((paragraph) => inlineText(paragraph.content).replace(/\n/g, " "))
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join(CELL_SEPARATOR)

/** A block's text: a quote as the blocks it holds. */
function blockTexts(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return [inlineText(block.content)]
    case "bulletList":
    case "orderedList":
      return [itemLines(block.content).filter(Boolean).join("\n")]
    case "blockquote":
      return block.content.flatMap(blockTexts)
    case "table":
      return [block.content.map(rowLine).filter(Boolean).join("\n")]
    case "image":
    case "productCard":
    case "categoryCard":
      return []
  }
}

/** A text cut at a word before `max` characters (a block too long to keep whole). */
function atWord(text: string, max: number): string {
  const cut = text.slice(0, max)
  const space = cut.search(/\s\S*$/)
  return (space > max / 2 ? cut.slice(0, space) : cut).trim()
}

/** The document's plain text, and whether it was cut to fit `max`. */
export function docPlainText(doc: ContentDoc, max: number): { text: string; cut: boolean } {
  let text = ""
  for (const block of doc.content.flatMap(blockTexts).filter(Boolean)) {
    const next = text === "" ? block : `${text}\n\n${block}`
    if (next.length > max) {
      return { text: text === "" ? atWord(block, max) : text, cut: true }
    }
    text = next
  }
  return { text, cut: false }
}

/** Whether a document holds any text (an editor's empty paragraph does not). */
export const hasText = (doc: ContentDoc): boolean => docPlainText(doc, Infinity).text !== ""
