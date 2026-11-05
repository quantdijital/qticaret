import type { Block } from "../../content/doc"
import { bodyBlocks } from "../../migration/sources/wordpress/html"
import { decodeEntities, withoutHidden } from "../../migration/text"
import { factRow, factsFromBlocks } from "./extract"
import type { FactRow } from "./extract"
import {
  cleanLabel,
  cleanValue,
  isHeadingLike,
  isLabel,
  isSpecHeading,
  textLineFact,
  tidy,
} from "./text"

/**
 * Where a product's facts are read from (adr/0013 Ek 2026-11-05): its
 * description document when it has one; else its description as HTML
 * (a definition list's terms and descriptions too, as the document has
 * none) or as the plain text the document's rules wrote (a table row's
 * cells joined by " · ", list items one per line). Nothing is written.
 */

export type FactSource = "doc" | "html" | "text"

export interface ProductFacts {
  rows: FactRow[]
  source: FactSource | null
}

// HTML larger than a description document holds is read to this point
const MAX_HTML = 1_000_000
const TAG = /<\/?[a-z][a-z0-9]*\b[^<>]*>/i
const DL = /<dl\b[^<>]*>([\s\S]*?)<\/dl\s*>/gi
const DL_ITEM = /<(dt|dd)\b[^<>]*>([\s\S]*?)(?=<\/?(?:dt|dd)\b|$)/gi

const textOf = (html: string): string => tidy(decodeEntities(html.replace(/<[^<>]*>/g, " ")))

/** A definition list's terms and their descriptions (several descriptions joined). */
export function definitionFacts(html: string): FactRow[] {
  const rows: FactRow[] = []
  let list = 0
  for (const [, body = ""] of withoutHidden(html.slice(0, MAX_HTML)).matchAll(DL)) {
    let term: { text: string; at: number } | null = null
    let values: string[] = []
    let at = 0
    const flush = () => {
      const value = cleanValue(values.join(", "))
      if (term && value !== null && isLabel(term.text)) {
        const path = `html.dl.${String(list)}.${String(term.at)}`
        rows.push(factRow({ label: cleanLabel(term.text), value }, path, null))
      }
      values = []
    }
    for (const [, tag = "", inner = ""] of body.matchAll(DL_ITEM)) {
      const text = textOf(inner)
      if (tag.toLowerCase() === "dt") {
        flush()
        term = text ? { text, at } : null
        at += 1
      } else if (text) {
        values.push(text)
      }
    }
    flush()
    list += 1
  }
  return rows
}

/** Facts from HTML: its blocks as the document would hold them, and its definition lists. */
export function factsFromHtml(html: string): FactRow[] {
  const blocks = bodyBlocks(html.slice(0, MAX_HTML), { shortcodes: false }).blocks
  return [...factsFromBlocks(blocks, "html"), ...definitionFacts(html)]
}

const CELLS = /\s+[·|]\s+/

/**
 * Facts from plain text, as `product.description` keeps a document's: a
 * line of two cells ("Label · value") anywhere, "Label: value" lines under
 * a heading of facts (a line of its own) or in a run of at least two. A
 * blank line does not break a run: older imports kept each list item and
 * table row as a paragraph of its own (adr/0055).
 */
export function factsFromText(text: string): FactRow[] {
  const rows: FactRow[] = []
  let section = false
  let context: string | null = null
  let loose: FactRow[] = []
  const endLoose = () => {
    if (loose.length >= 2) {
      rows.push(...loose)
    }
    loose = []
  }
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = tidy(raw)
    const path = `text.line.${String(index)}`
    if (line === "") {
      return
    }
    const cells = line.split(CELLS)
    if (cells.length === 2 && cells[0] && cells[1] && isLabel(cells[0])) {
      const value = cleanValue(cells[1])
      if (value !== null) {
        rows.push(factRow({ label: cleanLabel(cells[0]), value }, path, context))
        return
      }
    }
    const fact = textLineFact(line, section)
    if (fact) {
      const row = factRow(fact, path, context)
      if (section) {
        rows.push(row)
      } else {
        loose.push(row)
      }
      return
    }
    endLoose()
    if (isHeadingLike(line)) {
      // A heading of facts opens a section; another names the lines under it
      const title = cleanLabel(line)
      section = isSpecHeading(title) || section
      context = isSpecHeading(title) ? null : title
      return
    }
    section = false
    context = null
  })
  endLoose()
  return rows.slice(0, 200)
}

const isDoc = (value: unknown): value is { type: "doc"; content: Block[] } =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "doc" &&
  Array.isArray((value as { content?: unknown }).content)

/** A product's facts: from its document, else its description as HTML or plain text. */
export function productFacts(input: { doc?: unknown; description?: string | null }): ProductFacts {
  if (isDoc(input.doc)) {
    return { rows: factsFromBlocks(input.doc.content), source: "doc" }
  }
  const text = input.description ?? ""
  if (text.trim() === "") {
    return { rows: [], source: null }
  }
  return TAG.test(text)
    ? { rows: factsFromHtml(text), source: "html" }
    : { rows: factsFromText(text), source: "text" }
}
