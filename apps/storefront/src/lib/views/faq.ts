import type { FaqGroupView } from "@qticaret/ui"
import { anchorOf, freeAnchor, wordsOf } from "./legal-outline"

/**
 * A questions-and-answers page read from the shop's own text (adr/0019
 * HTML, adr/0046 Ek 2026-11-05 içerik sayfaları), so a theme can draw it
 * as disclosures: each question a line set wholly in bold, or a heading,
 * ending in "?"; its answer what follows up to the next question or
 * heading; the other headings name the groups. Fewer than three questions
 * is an ordinary page. Nothing is rewritten: the answers are the
 * backend's HTML as it came.
 */

/** A top-level element of the backend's HTML: its tag, its inner HTML and the whole of it. */
interface Block {
  tag: string
  inner: string
  outer: string
}

const OPEN = /<([a-z][a-z0-9]*)(?:\s[^>]*)?>/y

/** The HTML's top-level elements in order; text outside any element is left out. */
export function blocksOf(html: string): Block[] {
  const blocks: Block[] = []
  let at = 0
  while (at < html.length) {
    const start = html.indexOf("<", at)
    if (start < 0) {
      break
    }
    OPEN.lastIndex = start
    const open = OPEN.exec(html)
    if (!open?.[1]) {
      at = start + 1
      continue
    }
    const tag = open[1]
    const end = closeOf(html, tag, start + open[0].length)
    if (end < 0) {
      break
    }
    const close = `</${tag}>`
    blocks.push({
      tag,
      inner: html.slice(start + open[0].length, end),
      outer: html.slice(start, end + close.length),
    })
    at = end + close.length
  }
  return blocks
}

/** Where the element opened at `from` closes, counting the same tag nested inside (a list in a list). */
function closeOf(html: string, tag: string, from: number): number {
  const pattern = new RegExp(`<(/?)${tag}(?:\\s[^>]*)?>`, "g")
  pattern.lastIndex = from
  let depth = 1
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[1] ? -1 : 1
    if (depth === 0) {
      return match.index
    }
  }
  return -1
}

const HEADING = /^h[2-4]$/
const BOLD_LINE = /^\s*<strong>([\s\S]*?)<\/strong>\s*$/

const asks = (words: string): boolean => /\?\s*$/.test(words)

/** A line set wholly in bold that asks: the question's words; else null. */
function boldQuestion(block: Block): string | null {
  if (block.tag !== "p") {
    return null
  }
  const bold = BOLD_LINE.exec(block.inner)
  const words = bold?.[1] && !bold[1].includes("<strong") ? wordsOf(bold[1]) : ""
  return words && asks(words) ? words : null
}

/** A heading that asks: the question's words; else null. */
function headingQuestion(block: Block): string | null {
  if (!HEADING.test(block.tag)) {
    return null
  }
  const words = wordsOf(block.inner)
  return words && asks(words) ? words : null
}

const MIN_QUESTIONS = 3

/**
 * The page's questions by group, and the text before the first one; null
 * when the page does not read as questions and answers. Bold questions
 * win where there are enough of them (then every heading is a group's,
 * even one ending in "?"); else asking headings are the questions and
 * the rest name the groups. `taken`: the ids the page has already
 * (`withOutline`'s), the groups' anchors kept clear of them.
 */
export function faqOf(
  html: string,
  taken: Set<string> = new Set<string>()
): { intro: string; groups: FaqGroupView[] } | null {
  const blocks = blocksOf(html)
  const bold = blocks.filter((block) => boldQuestion(block) !== null).length
  const questionOf = bold >= MIN_QUESTIONS ? boldQuestion : headingQuestion
  if (blocks.filter((block) => questionOf(block) !== null).length < MIN_QUESTIONS) {
    return null
  }
  let intro = ""
  const groups: FaqGroupView[] = []
  const group = (title: string | null): FaqGroupView => {
    // A heading of no letters or digits still gets an anchor
    const anchor = title ? anchorOf(title) : ""
    const id = freeAnchor(anchor !== "" ? anchor : `sorular-${String(groups.length + 1)}`, taken)
    const made: FaqGroupView = { id, title, lead: "", items: [] }
    groups.push(made)
    return made
  }
  let current: FaqGroupView | null = null
  for (const block of blocks) {
    const question = questionOf(block)
    if (question !== null) {
      current ??= group(null)
      current.items.push({ question, html: "" })
      continue
    }
    if (HEADING.test(block.tag)) {
      current = group(wordsOf(block.inner) || null)
      continue
    }
    const last = current?.items.at(-1)
    if (last) {
      last.html += block.outer
    } else if (current) {
      current.lead += block.outer
    } else {
      intro += block.outer
    }
  }
  return { intro, groups: groups.filter((each) => each.items.length > 0 || each.lead !== "") }
}
