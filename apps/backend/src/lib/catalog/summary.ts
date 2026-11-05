import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../content/doc"
import type {
  Block,
  BulletList,
  ContentDoc,
  Heading,
  Inline,
  ListItem,
  OrderedList,
  Paragraph,
} from "../content/doc"
import { docPlainText, hasText } from "../content/plain"

/**
 * A product's short description (adr/0055 Ek 2026-11-06): what the shop
 * wrote to introduce the product, shown as written under its name, above
 * its price. A content document of the long description's model and
 * checks (adr/0019, adr/0055) held to what reads well in that slot:
 * paragraphs with line breaks, h3 and h4 headings, bullet and numbered
 * lists, bold, italic and links to the shop's pages or https addresses.
 * No h2, quotes, tables, pictures or cards; at most 1,500 characters of
 * text. Optional: a product is published without one. Where the shop
 * wrote no SEO description, its plain text fills the meta description,
 * JSON-LD and the feeds.
 */

/** The text's cap, in characters of its text (line breaks and blocks not counted). */
export const SUMMARY_TEXT_MAX = 1_500

export type SummaryBlock = Paragraph | Heading | BulletList | OrderedList

/** A short description as the extension's `summary_doc` column holds it. */
// A type, not an interface: the column's JSON type takes it only with an implicit index signature
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type SummaryDoc = { type: "doc"; content: SummaryBlock[] }

const HEADING_LEVELS: ReadonlySet<number> = new Set([3, 4])
const HTTPS = /^https:\/\//i

/** A link a short description takes: a path on the shop or an https address (checked safe before). */
export const isSummaryHref = (href: string): boolean => href.startsWith("/") || HTTPS.test(href)

const isSummaryBlock = (block: Block): block is SummaryBlock =>
  block.type === "paragraph" ||
  block.type === "bulletList" ||
  block.type === "orderedList" ||
  (block.type === "heading" && HEADING_LEVELS.has(block.attrs.level))

/** Every inline node of the blocks, list items' included. */
function inlinesOf(blocks: readonly (SummaryBlock | ListItem["content"][number])[]): Inline[] {
  return blocks.flatMap((block): Inline[] =>
    block.type === "paragraph" || block.type === "heading"
      ? (block.content ?? [])
      : block.content.flatMap((item) => inlinesOf(item.content))
  )
}

/** The characters of its text, as the cap counts them (the panel's counter counts the same). */
export const summaryLength = (blocks: readonly SummaryBlock[]): number =>
  inlinesOf(blocks).reduce((sum, node) => sum + (node.type === "text" ? node.text.length : 0), 0)

/** Why a checked document is no short description; null when it is one. */
export function summaryProblem(doc: ContentDoc): string | null {
  if (!doc.content.every(isSummaryBlock)) {
    return "catalog.summary_blocks"
  }
  const blocks = doc.content
  const links = inlinesOf(blocks).flatMap((node) =>
    node.type === "text"
      ? (node.marks ?? []).flatMap((mark) => (mark.type === "link" ? [mark] : []))
      : []
  )
  if (links.some((mark) => !isSummaryHref(mark.attrs.href))) {
    return "catalog.summary_link"
  }
  return summaryLength(blocks) > SUMMARY_TEXT_MAX ? "catalog.summary_too_long" : null
}

/** A short description as the panel's editor sends it: the content checks, then the short slot's. */
export const productSummaryDoc = z.unknown().transform((value, ctx): SummaryDoc => {
  const parsed = contentDoc.safeParse(value)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path })
    }
    return z.NEVER
  }
  const problem = summaryProblem(parsed.data)
  if (problem) {
    ctx.addIssue({ code: "custom", message: problem })
    return z.NEVER
  }
  return parsed.data as SummaryDoc
})

/**
 * A stored value as a short description: checked again (a value that no
 * longer reads as one is none) and none without text.
 */
export function summaryDocOf(stored: unknown): SummaryDoc | null {
  if (stored === null || stored === undefined) {
    return null
  }
  const parsed = productSummaryDoc.safeParse(stored)
  return parsed.success && hasText(parsed.data) ? parsed.data : null
}

/**
 * Plain text as a short description (a sheet's cell): one paragraph, its
 * lines kept as line breaks, blank lines and runs of spaces dropped.
 * Null for no text; the cap is the caller's to check (`summaryLength`).
 */
export function summaryDocOfText(text: string): SummaryDoc | null {
  const lines = text
    .split(/\r\n?|\n/u)
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line) => line !== "")
  if (lines.length === 0) {
    return null
  }
  const content = lines.flatMap((line, index): Inline[] =>
    index === 0
      ? [{ type: "text", text: line }]
      : [{ type: "hardBreak" }, { type: "text", text: line }]
  )
  return { type: "doc", content: [{ type: "paragraph", content }] }
}

const DANGLING = /[\s,;:–—-]+$/u
const SENTENCE_END = /[.!?…:;,]$/u

/** A stored value's short description as one line of plain text (`summaryText`); none, "". */
export const storedSummaryText = (stored: unknown): string => summaryText(summaryDocOf(stored))

/** A text cut at a word before `max` characters, without a dangling comma or joiner. */
function atWord(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(DANGLING, "")
}

/**
 * The short description as one line of plain text, for a meta
 * description, JSON-LD and feeds: its blocks, list items and lines in
 * order, each closed as a sentence where the shop left it open ("Yıkanmış
 * keten. Rahat kesim."), cut at a word within `max`. Nothing for none.
 */
export function summaryText(
  doc: SummaryDoc | null,
  max: number = Number.POSITIVE_INFINITY
): string {
  if (!doc) {
    return ""
  }
  const text = docPlainText(doc, Number.POSITIVE_INFINITY)
    .text.split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line) => line !== "")
    .map((line) => (SENTENCE_END.test(line) ? line : `${line}.`))
    .join(" ")
  return atWord(text, max)
}
