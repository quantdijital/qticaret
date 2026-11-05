import { SUMMARY_LIMITS, sourceLine } from "../../../catalog/summary"
import type { Block, Inline, ListItem } from "../../../content/doc"
import type { BodyOptions } from "./html"
import { bodyBlocks } from "./html"

/**
 * A WooCommerce product's short description (`excerpt:encoded`) as the
 * product's short description lines (adr/0055 Ek 2026-11-05), read with
 * the body's converter (tags only ever dropped or mapped):
 * - a list, or a table of label and value rows: its items, five at most;
 *   a paragraph beside a list only leads into it and is left out;
 * - paragraphs alone: their lines (a `<br>` ends one) and sentences, when
 *   they come to five short lines at most; else the first sentence alone.
 * `partial`: some of it did not come (the report names the product).
 */

export interface ExcerptSummary {
  lines: string[]
  partial: boolean
}

const { lines: MAX_LINES, length: MAX_LENGTH } = SUMMARY_LIMITS
// A sentence ends at . ! ? or … followed by a space and a capital, a digit or an opening quote
const SENTENCE_BREAK = /(?<=[.!?…])\s+(?=[\p{Lu}\p{N}"'“‘(])/u
// A closing full stop, comma or semicolon (not an ellipsis), which a list line does without
const LINE_END = /(?<!\.)[.,;]$/u

const inlineLines = (content: readonly Inline[] | undefined): string[] =>
  (content ?? [])
    .map((node) => (node.type === "text" ? node.text : "\n"))
    .join("")
    .split("\n")

const lineOf = (text: string): string => sourceLine(text).replace(LINE_END, "").trim()

function itemTexts(items: readonly ListItem[]): string[] {
  return items.flatMap((item) =>
    item.content.flatMap((child) =>
      child.type === "paragraph" ? [inlineLines(child.content).join(" ")] : itemTexts(child.content)
    )
  )
}

/** A list's items and a table's rows ("Namlu: 9 cm"), quotes looked into. */
function listTexts(blocks: readonly Block[]): string[] {
  return blocks.flatMap((block): string[] => {
    switch (block.type) {
      case "bulletList":
      case "orderedList":
        return itemTexts(block.content)
      case "table":
        return block.content.map((row) => {
          const cells = row.content
            .map((cell) =>
              sourceLine(cell.content.flatMap((p) => inlineLines(p.content)).join(" "))
            )
            .filter(Boolean)
          return cells.join(cells.length === 2 ? ": " : " · ")
        })
      case "blockquote":
        return listTexts(block.content)
      case "paragraph":
      case "heading":
      case "image":
      case "productCard":
      case "categoryCard":
        return []
    }
  })
}

function paragraphTexts(blocks: readonly Block[]): string[] {
  return blocks.flatMap((block): string[] =>
    block.type === "paragraph"
      ? inlineLines(block.content)
      : block.type === "blockquote"
        ? paragraphTexts(block.content)
        : []
  )
}

/** A line past the limit, cut at a word with an ellipsis. */
function fit(line: string): string {
  if (line.length <= MAX_LENGTH) {
    return line
  }
  const room = line.slice(0, MAX_LENGTH - 1)
  const space = room.lastIndexOf(" ")
  return `${(space > MAX_LENGTH / 2 ? room.slice(0, space) : room).replace(/[\s,;:–—-]+$/u, "")}…`
}

/** The excerpt's lines; null for an excerpt without text. */
export function summaryFromExcerpt(html: string, options: BodyOptions = {}): ExcerptSummary | null {
  if (html.trim() === "") {
    return null
  }
  const { blocks } = bodyBlocks(html, options)
  const items = listTexts(blocks).map(lineOf).filter(Boolean)
  if (items.length > 0) {
    return {
      lines: items.slice(0, MAX_LINES).map(fit),
      partial: items.length > MAX_LINES || items.some((line) => line.length > MAX_LENGTH),
    }
  }
  const sentences = paragraphTexts(blocks)
    .map(sourceLine)
    // A line that only leads into what follows ("Özellikler:") says nothing alone
    .filter((line) => line !== "" && !line.endsWith(":"))
    .flatMap((line) => line.split(SENTENCE_BREAK))
    .map(lineOf)
    .filter(Boolean)
  const [first] = sentences
  if (first === undefined) {
    return null
  }
  return sentences.length <= MAX_LINES && sentences.every((line) => line.length <= MAX_LENGTH)
    ? { lines: sentences, partial: false }
    : { lines: [fit(first)], partial: true }
}
