import type { Inline } from "../../content/doc"
import { toSlug } from "../../seo/slug"
import { REMARK_LABELS, SPEC_HEADINGS, TABLE_HEADER_WORDS } from "./vocabulary"

/**
 * How the facts reader compares and cuts text (adr/0013 Ek 2026-11-05):
 * a label's key folds Turkish letters and case the way a URL slug does
 * ("Bıçak Boyu", "BIÇAK BOYU:" and "bicak boyu" are one), a line is a
 * fact when it reads "Label: value" or opens with a bold label.
 */

/** A label as it is compared: Turkish letters folded, case, accents and punctuation off. */
export const labelKey = (text: string): string => toSlug(text, 200)

const keys = (words: readonly string[]): ReadonlySet<string> => new Set(words.map(labelKey))

const SPEC_HEADING_KEYS = keys(SPEC_HEADINGS)
const HEADER_WORD_KEYS = keys(TABLE_HEADER_WORDS)
const REMARK_KEYS = keys(REMARK_LABELS)

/** Whether a heading (or a bold line standing as one) opens a section of facts. */
export const isSpecHeading = (text: string): boolean => SPEC_HEADING_KEYS.has(labelKey(text))

/** Whether a table cell only names its column ("Özellik", "Değer"). */
export const isHeaderWord = (text: string): boolean =>
  text.trim() === "" || HEADER_WORD_KEYS.has(labelKey(text))

export const isRemark = (label: string): boolean => REMARK_KEYS.has(labelKey(label))

const MAX_LABEL = 80
const MAX_LABEL_WORDS = 8
const MAX_VALUE = 500
const HAS_LETTER = /\p{L}/u
// A sentence's end, a link, a list of clauses: not a label
const NOT_A_LABEL = /[.!?;]$|:\/\/|[{}<>]/
const BULLETS = /^[\s•·\-–—*✓✔►▪▸◦>]+/u
const EDGES = /^[\s:：\-–—]+|[\s:：\-–—]+$/g

/** Spaces made one, ends trimmed. */
export const tidy = (text: string): string => text.replace(/\s+/g, " ").trim()

/** A label as written, without the bullet before it and the colon after it. */
export const cleanLabel = (text: string): string =>
  tidy(text.replace(BULLETS, "")).replace(EDGES, "")

/** Whether text can be a fact's label: short, with a letter, no sentence. */
export function isLabel(text: string): boolean {
  const label = cleanLabel(text)
  return (
    label.length > 0 &&
    label.length <= MAX_LABEL &&
    label.split(" ").length <= MAX_LABEL_WORDS &&
    HAS_LETTER.test(label) &&
    !NOT_A_LABEL.test(label) &&
    !isRemark(label)
  )
}

/** A value as written, its ends tidied; none when empty or past a field's length. */
export function cleanValue(text: string): string | null {
  const value = tidy(text)
    .replace(/^[\s:：\-–—]+/, "")
    .trim()
  return value === "" || value.length > MAX_VALUE ? null : value
}

/** The runs of a paragraph, one list per line (a hard break starts the next). */
export function linesOf(content: readonly Inline[] | undefined): Inline[][] {
  const lines: Inline[][] = [[]]
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      lines.push([])
    } else {
      lines.at(-1)?.push(node)
    }
  }
  return lines.filter((line) => runsText(line) !== "")
}

/** A line's text. */
export const runsText = (runs: readonly Inline[]): string =>
  tidy(runs.map((node) => (node.type === "text" ? node.text : " ")).join(""))

const isBold = (node: Inline): boolean =>
  node.type === "text" && (node.marks ?? []).some((mark) => mark.type === "bold")

/** Whether the whole line is bold: a heading written as a bold paragraph. */
export const isAllBold = (runs: readonly Inline[]): boolean =>
  runs.length > 0 &&
  runs.every((node) => node.type !== "text" || node.text.trim() === "" || isBold(node))

export interface LineFact {
  label: string
  value: string
}

/** "Label: value", the label before the first colon. */
function byColon(text: string): LineFact | null {
  const at = text.search(/[:：]/)
  if (at <= 0) {
    return null
  }
  const label = text.slice(0, at)
  const value = cleanValue(text.slice(at + 1))
  return value !== null && isLabel(label) ? { label: cleanLabel(label), value } : null
}

/** A bold label and plain text after it: "**Label** value". */
function byBoldLabel(runs: readonly Inline[]): LineFact | null {
  const firstPlain = runs.findIndex(
    (node) => node.type === "text" && node.text.trim() !== "" && !isBold(node)
  )
  if (firstPlain <= 0) {
    return null
  }
  const label = runsText(runs.slice(0, firstPlain))
  const value = cleanValue(runsText(runs.slice(firstPlain)))
  return value !== null && isLabel(label) ? { label: cleanLabel(label), value } : null
}

/** "Label – value", only inside a section of facts, where a dash cannot be anything else. */
function byDash(text: string): LineFact | null {
  const match = /^(.+?)\s+[-–—]\s+(.+)$/.exec(text)
  if (!match?.[1] || !match[2]) {
    return null
  }
  const value = cleanValue(match[2])
  return value !== null && isLabel(match[1]) ? { label: cleanLabel(match[1]), value } : null
}

/** A line as a fact, or none. `section`: under a heading of facts, where a dash separates too. */
export function lineFact(runs: readonly Inline[], section: boolean): LineFact | null {
  const text = runsText(runs).replace(BULLETS, "")
  return byColon(text) ?? byBoldLabel(runs) ?? (section ? byDash(text) : null)
}

/** A line's fact, from plain text (no marks): a colon, or a dash inside a section. */
export const textLineFact = (line: string, section: boolean): LineFact | null => {
  const text = tidy(line).replace(BULLETS, "")
  return byColon(text) ?? (section ? byDash(text) : null)
}

/** A short line standing as a heading: no colon value, no sentence end. */
export const isHeadingLike = (text: string): boolean => {
  const line = tidy(text).replace(/[:：]$/, "")
  return line.length > 0 && line.length <= 60 && !/[.!?;:：]/.test(line) && HAS_LETTER.test(line)
}
