import type { Block, ContentDoc, Inline, ListItem, Paragraph } from "./doc"
import { linkOf } from "./render"

export interface DocStats {
  /** Plain text, blocks on their own lines: for the meta description, JSON-LD and search. */
  text: string
  words: number
  /** Words before the first heading: the opening a reader (and an answer engine) meets first. */
  openingWords: number
  headings: { level: 2 | 3 | 4; text: string }[]
  /** Each paragraph's sentence and word count, in order. */
  paragraphs: { sentences: number; words: number }[]
  links: { internal: number; external: number }
  images: { src: string; alt: string }[]
  tables: number
  lists: number
  cards: { product: string[]; category: string[] }
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu
// A sentence ends at the last of . ! ? … before a space or the end. One mark
// at a time, no run: a run with a quantifier backtracks on "....a" (quadratic)
const SENTENCE_END = /[.!?…](?=\s|$)/g

export const countWords = (text: string): number => text.match(WORD)?.length ?? 0

function countSentences(text: string): number {
  const trimmed = text.trim()
  if (trimmed === "") {
    return 0
  }
  // Text after the last end (or with none) is a sentence too
  const open = /[.!?…]$/.test(trimmed) ? 0 : 1
  return (trimmed.match(SENTENCE_END)?.length ?? 0) + open
}

function inlineText(content: readonly Inline[] | undefined, stats: DocStats): string {
  let text = ""
  // Neighbours linking to one address are one link (a partly bold link)
  let previous: string | null = null
  for (const node of content ?? []) {
    const href = linkOf(node)
    if (href !== null && href !== previous) {
      stats.links[href.startsWith("/") ? "internal" : "external"] += 1
    }
    previous = href
    text += node.type === "hardBreak" ? "\n" : node.text
  }
  return text
}

function paragraph(node: Paragraph, stats: DocStats, lines: string[], counted: boolean) {
  const text = inlineText(node.content, stats).trim()
  if (!text) {
    return
  }
  lines.push(text)
  if (stats.headings.length === 0) {
    stats.openingWords += countWords(text)
  }
  if (counted) {
    stats.paragraphs.push({ sentences: countSentences(text), words: countWords(text) })
  }
}

function listItem(item: ListItem, stats: DocStats, lines: string[]) {
  for (const child of item.content) {
    if (child.type === "paragraph") {
      paragraph(child, stats, lines, false)
    } else {
      walk(child, stats, lines)
    }
  }
}

function walk(node: Block, stats: DocStats, lines: string[]) {
  switch (node.type) {
    case "paragraph":
      paragraph(node, stats, lines, true)
      return
    case "heading": {
      const text = inlineText(node.content, stats).trim()
      if (text) {
        stats.headings.push({ level: node.attrs.level, text })
        lines.push(text)
      }
      return
    }
    case "bulletList":
    case "orderedList":
      stats.lists += 1
      node.content.forEach((item) => {
        listItem(item, stats, lines)
      })
      return
    case "blockquote":
      node.content.forEach((child) => {
        walk(child, stats, lines)
      })
      return
    case "table":
      stats.tables += 1
      for (const row of node.content) {
        const cells = row.content.map((cell) =>
          cell.content.map((p) => inlineText(p.content, stats).trim()).join(" ")
        )
        lines.push(cells.filter(Boolean).join(" | "))
      }
      return
    case "image":
      stats.images.push({ src: node.attrs.src, alt: node.attrs.alt?.trim() ?? "" })
      return
    case "productCard":
      stats.cards.product.push(node.attrs.id)
      return
    case "categoryCard":
      stats.cards.category.push(node.attrs.id)
      return
  }
}

/** Text as one line, cut at a word before `max` characters: a summary, not markup. */
export function summaryOf(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim()
  if (line.length <= max) {
    return line
  }
  const cut = line.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/u, "")
}

/** What a document says and how it is built: the advisor's and the meta's view of it. */
export function docStats(doc: ContentDoc): DocStats {
  const stats: DocStats = {
    text: "",
    words: 0,
    openingWords: 0,
    headings: [],
    paragraphs: [],
    links: { internal: 0, external: 0 },
    images: [],
    tables: 0,
    lists: 0,
    cards: { product: [], category: [] },
  }
  const lines: string[] = []
  for (const node of doc.content) {
    walk(node, stats, lines)
  }
  stats.text = lines.filter(Boolean).join("\n")
  stats.words = countWords(stats.text)
  return stats
}
