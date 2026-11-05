import type { SummaryDoc } from "../../../catalog/summary"
import type { Block, Inline, ListItem } from "../../../content/doc"
import { bodyBlocks } from "./html"
import type { Wxr } from "./reader"

/**
 * FROZEN: the lines the 2026-11-05 build made of a WooCommerce excerpt
 * (adr/0055 Ek 2026-11-05, "madde madde"), kept only so `summary:backfill`
 * can tell a short description that build wrote from one the shop wrote
 * (adr/0055 Ek 2026-11-06). Its lines became a bullet list when the
 * column turned into a document (Migration20261106093741); the backfill
 * writes the excerpt as written over a product whose document is still
 * exactly that list. Never used to read a source. Remove once every shop
 * that ran that build has run the backfill.
 */

const MAX_LINES = 5
const MAX_LENGTH = 90
// A sentence ends at . ! ? or … followed by a space and a capital, a digit or an opening quote
const SENTENCE_BREAK = /(?<=[.!?…])\s+(?=[\p{Lu}\p{N}"'“‘(])/u
// A closing full stop, comma or semicolon (not an ellipsis), which a list line does without
const LINE_END = /(?<!\.)[.,;]$/u
const HIDDEN = /[\p{Cc}\p{Cf}]/gu

const summaryLine = (text: string): string => text.replace(/\s+/gu, " ").trim()
const sourceLine = (text: string): string =>
  summaryLine(text.replace(/\s/gu, " ").replace(HIDDEN, ""))

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

function fit(line: string): string {
  if (line.length <= MAX_LENGTH) {
    return line
  }
  const room = line.slice(0, MAX_LENGTH - 1)
  const space = room.lastIndexOf(" ")
  return `${(space > MAX_LENGTH / 2 ? room.slice(0, space) : room).replace(/[\s,;:–—-]+$/u, "")}…`
}

/** The 2026-11-05 build's lines of an excerpt; none for one without text. */
export function legacyExcerptLines(html: string, title: string): string[] {
  if (html.trim() === "") {
    return []
  }
  const { blocks } = bodyBlocks(html, { title })
  const items = listTexts(blocks).map(lineOf).filter(Boolean)
  if (items.length > 0) {
    return items.slice(0, MAX_LINES).map(fit)
  }
  const sentences = paragraphTexts(blocks)
    .map(sourceLine)
    .filter((line) => line !== "" && !line.endsWith(":"))
    .flatMap((line) => line.split(SENTENCE_BREAK))
    .map(lineOf)
    .filter(Boolean)
  const [first] = sentences
  if (first === undefined) {
    return []
  }
  return sentences.length <= MAX_LINES && sentences.every((line) => line.length <= MAX_LENGTH)
    ? sentences
    : [fit(first)]
}

/** Lines as the migration turned them into a document: one bullet list, an item each. */
export const legacySummaryDoc = (lines: readonly string[]): SummaryDoc => ({
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: lines.map((text) => ({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text }] }],
      })),
    },
  ],
})

/** Each product of the export (by its source key) with what the 2026-11-05 build wrote of it. */
export function legacySummaries(wxr: Wxr): Map<string, SummaryDoc> {
  const found = new Map<string, SummaryDoc>()
  for (const item of wxr.items.filter((each) => each.type === "product")) {
    const lines = legacyExcerptLines(item.excerpt, item.title)
    if (lines.length > 0) {
      found.set(`product:${item.id}`, legacySummaryDoc(lines))
    }
  }
  return found
}
