import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../security/text"

/**
 * A product's short description (adr/0055 Ek 2026-11-05): up to five
 * short plain-text lines, the product page's list under the name and
 * above the price ("N690 çelik, 58-59 HRC", "2 yıl garanti"). Kept in the
 * extension's `summary` (`text[]`): lines only, no markup, so nothing in
 * them is ever printed as HTML. Optional: a product is published
 * without one. Where the shop wrote no SEO description, its lines as
 * sentences fill the meta description, JSON-LD and the feeds.
 */

export const SUMMARY_LIMITS = { lines: 5, length: 90 } as const

// What a request may send before its lines are tidied: a bound on the payload, not a rule
const MAX_SENT_LINES = 50
const MAX_SENT_LENGTH = 1000

// Invisible and direction-changing characters (zero-width, bidi overrides): they disguise text
const FORMAT_CHARACTER = /\p{Cf}/u

/** A line as it is kept: every run of spaces (a tab, a line break) one space, trimmed. */
export const summaryLine = (text: string): string => text.replace(/\s+/gu, " ").trim()

// Control and invisible characters a source's text may carry (a zero-width space)
const HIDDEN = /[\p{Cc}\p{Cf}]/gu

/** A source's line as a save would take it: spaces tidied, hidden characters dropped. */
export const sourceLine = (text: string): string =>
  summaryLine(text.replace(/\s/gu, " ").replace(HIDDEN, ""))

/**
 * The lines as a save sends them: tidied, empty ones dropped; five at
 * most, each 90 characters at most, plain text. None (an empty list)
 * clears the product's.
 */
export const productSummary = z
  .array(z.string().max(MAX_SENT_LENGTH))
  .max(MAX_SENT_LINES)
  .transform((sent, ctx): string[] => {
    const lines = sent.map(summaryLine).filter((line) => line !== "")
    const problem =
      lines.length > SUMMARY_LIMITS.lines
        ? "catalog.summary_too_many"
        : lines.some((line) => line.length > SUMMARY_LIMITS.length)
          ? "catalog.summary_too_long"
          : lines.some((line) => !isCleanText(line) || FORMAT_CHARACTER.test(line))
            ? "catalog.summary_invalid"
            : null
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem })
      return z.NEVER
    }
    return lines
  })

/** A stored value's lines: strings only, tidied, empty ones dropped, five at most. */
export function summaryOf(stored: unknown): string[] {
  if (!Array.isArray(stored)) {
    return []
  }
  return stored
    .filter((line): line is string => typeof line === "string")
    .map(summaryLine)
    .filter((line) => line !== "")
    .slice(0, SUMMARY_LIMITS.lines)
}

// A line's own closing marks, dropped before it becomes a sentence
const LINE_END = /[\s.,;:]+$/u
const SENTENCE_END = /[.!?…]$/u
const DANGLING = /[\s,;:–—-]+$/u

/** A text cut at a word before `max` characters. */
function atWord(text: string, max: number): string {
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(DANGLING, "")
}

/**
 * The lines as sentences, for a meta description, JSON-LD and feeds:
 * "N690 çelik, 58-59 HRC. Geyik boynuzu sap. 2 yıl garanti." Whole lines
 * within `max` characters; a first line longer than that is cut at a
 * word. Nothing for no lines.
 */
export function summaryText(lines: readonly string[], max = Number.POSITIVE_INFINITY): string {
  let text = ""
  for (const line of lines) {
    const own = summaryLine(line).replace(LINE_END, "")
    if (own === "") {
      continue
    }
    const sentence = SENTENCE_END.test(own) ? own : `${own}.`
    const next = text === "" ? sentence : `${text} ${sentence}`
    if (next.length > max) {
      return text === "" ? atWord(sentence, max) : text
    }
    text = next
  }
  return text
}
