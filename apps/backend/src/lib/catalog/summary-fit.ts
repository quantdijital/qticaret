import type { Block, Inline, ListItem, Paragraph, TextNode } from "../content/doc"
import { docPlainText } from "../content/plain"
import { SUMMARY_TEXT_MAX, isSummaryHref, summaryDocOf, summaryLength } from "./summary"
import type { SummaryBlock, SummaryDoc } from "./summary"

/**
 * A source's short description (WooCommerce's excerpt) as the product
 * keeps it (adr/0055 Ek 2026-11-06): as the shop wrote it, held to the
 * short slot's set. Paragraphs, lists, bold, italic and line breaks stay;
 * a heading stays one (an h2 as an h3); a quote's paragraphs and lists
 * stay without the quote; a table's rows become lines of one paragraph
 * ("Ölçü: 28 cm"); pictures and cards go; a link to an http address
 * keeps its text without the link. Past 1,500 characters it is cut at
 * the cap (`cut`: the report names the product), at a list item or a
 * word, never split into bullets or shortened otherwise.
 */

// Less room than this left at the cap: the text ends at the block before
const MIN_PART = 20
const ELLIPSIS = "…"
const DANGLING = /[\s,;:–—-]+$/u

/** Inline nodes with only the links a short description takes. */
const linked = (content: readonly Inline[] | undefined): Inline[] =>
  (content ?? []).map((node) => {
    if (node.type !== "text" || !node.marks) {
      return node
    }
    const marks = node.marks.filter(
      (mark) => mark.type !== "link" || isSummaryHref(mark.attrs.href)
    )
    return marks.length > 0 ? { ...node, marks } : { type: "text", text: node.text }
  })

const paragraphOf = (content: readonly Inline[] | undefined): Paragraph => ({
  type: "paragraph",
  content: linked(content),
})

function itemOf(item: ListItem): ListItem {
  return {
    type: "listItem",
    content: item.content.map((child) =>
      child.type === "paragraph"
        ? paragraphOf(child.content)
        : { ...child, content: child.content.map(itemOf) }
    ),
  }
}

const textOf = (content: readonly Inline[] | undefined): string =>
  (content ?? [])
    .map((node) => (node.type === "text" ? node.text : " "))
    .join("")
    .replace(/\s+/gu, " ")
    .trim()

/** A table's rows as the lines of one paragraph: two cells as "label: value", more apart by " · ". */
function tableLines(block: Extract<Block, { type: "table" }>): SummaryBlock[] {
  const rows = block.content
    .map((row) => {
      const cells = row.content
        .map((cell) =>
          cell.content
            .map((paragraph) => textOf(paragraph.content))
            .join(" ")
            .trim()
        )
        .filter((text) => text !== "")
      return cells.join(cells.length === 2 ? ": " : " · ")
    })
    .filter((line) => line !== "")
  if (rows.length === 0) {
    return []
  }
  return [
    {
      type: "paragraph",
      content: rows.flatMap((line, index): Inline[] =>
        index === 0
          ? [{ type: "text", text: line }]
          : [{ type: "hardBreak" }, { type: "text", text: line }]
      ),
    },
  ]
}

function toSummary(block: Block): SummaryBlock[] {
  switch (block.type) {
    case "paragraph":
      return [paragraphOf(block.content)]
    case "heading":
      return [
        {
          type: "heading",
          attrs: { level: block.attrs.level === 2 ? 3 : block.attrs.level },
          content: linked(block.content),
        },
      ]
    case "bulletList":
    case "orderedList":
      return [{ ...block, content: block.content.map(itemOf) }]
    case "blockquote":
      return block.content.flatMap(toSummary)
    case "table":
      return tableLines(block)
    case "image":
    case "productCard":
    case "categoryCard":
      return []
  }
}

/** Inline nodes cut to `room` characters of text at a word, closed with an ellipsis. */
function cutInlines(content: readonly Inline[], room: number): Inline[] {
  let budget = room - ELLIPSIS.length
  const kept: Inline[] = []
  for (const node of content) {
    if (node.type !== "text") {
      kept.push(node)
      continue
    }
    if (node.text.length <= budget) {
      kept.push(node)
      budget -= node.text.length
      continue
    }
    const slice = node.text.slice(0, budget)
    const space = slice.search(/\s\S*$/u)
    const text = (space > 0 ? slice.slice(0, space) : slice).replace(DANGLING, "")
    const last: TextNode = { ...node, text: `${text}${ELLIPSIS}` }
    kept.push(last)
    break
  }
  return kept
}

/** As much of a block as `room` characters take, or null for none of it. */
function partOf(block: SummaryBlock, room: number): SummaryBlock | null {
  if (room < MIN_PART) {
    return null
  }
  if (block.type === "paragraph" || block.type === "heading") {
    return { ...block, content: cutInlines(block.content ?? [], room) }
  }
  const items: ListItem[] = []
  let left = room
  for (const item of block.content) {
    const length = summaryLength([{ ...block, content: [item] }])
    if (length > left) {
      break
    }
    items.push(item)
    left -= length
  }
  return items.length > 0 ? { ...block, content: items } : null
}

/** Blocks within the cap, and whether some were cut. */
function withinCap(blocks: readonly SummaryBlock[]): { blocks: SummaryBlock[]; cut: boolean } {
  const kept: SummaryBlock[] = []
  let room = SUMMARY_TEXT_MAX
  for (const block of blocks) {
    const length = summaryLength([block])
    if (length <= room) {
      kept.push(block)
      room -= length
      continue
    }
    const part = partOf(block, room)
    return { blocks: part ? [...kept, part] : kept, cut: true }
  }
  return { blocks: kept, cut: false }
}

/** The text as plain paragraphs, for blocks the checks still refuse. */
function plainParagraphs(blocks: readonly SummaryBlock[]): SummaryBlock[] {
  return docPlainText({ type: "doc", content: [...blocks] }, Number.POSITIVE_INFINITY)
    .text.split("\n\n")
    .map((paragraph): Paragraph => ({
      type: "paragraph",
      content: paragraph
        .split("\n")
        .flatMap((line, index): Inline[] =>
          index === 0
            ? [{ type: "text", text: line }]
            : [{ type: "hardBreak" }, { type: "text", text: line }]
        ),
    }))
}

/** A source's blocks as a short description; none without text. */
export function summaryFromBlocks(source: readonly Block[]): {
  doc: SummaryDoc | null
  cut: boolean
} {
  const { blocks, cut } = withinCap(source.flatMap(toSummary))
  const doc = summaryDocOf({ type: "doc", content: blocks })
  if (doc || blocks.length === 0) {
    return { doc, cut }
  }
  const plain = withinCap(plainParagraphs(blocks))
  return { doc: summaryDocOf({ type: "doc", content: plain.blocks }), cut: cut || plain.cut }
}
