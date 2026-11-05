/**
 * How the home page quotes a review: its customer's own words, cut,
 * never rewritten (Hallmark 58 keeps a screen to about eighty words).
 */

export interface QuoteWords {
  /** At most this many of the review's words, its title's included. */
  body: number
  /** A first sentence ending within this many words is quoted whole; null: cut by count only. */
  sentence: number | null
  /** The product named by this many of its words (the reader hears all); null: in full. */
  name: number | null
}

/** On its own: twelve words, the product's whole name (as the section was before the rating). */
export const QUOTED: QuoteWords = { body: 12, sentence: null, name: null }

/**
 * Beside the shop's rating, which already says how good: a line each
 * saying why (its first sentence, or a clause), the product by the first
 * words of its name, so the four columns stay one screen's words.
 */
export const QUOTED_RATED: QuoteWords = { body: 10, sentence: 12, name: 5 }

/** The words up to `count`, cut at a word with an ellipsis (no separator left last). */
export function excerpt(text: string, count: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= count) {
    return text.trim()
  }
  const kept = words.slice(0, count)
  while (kept.length > 1 && !/[\p{L}\p{N}]/u.test(kept.at(-1) ?? "")) {
    kept.pop()
  }
  return `${kept.join(" ")}…`
}

/** A sentence's last word: a full stop, a question or an exclamation, quotes or brackets after it. */
const SENTENCE_END = /[.!?…]["'”’)]*$/
/** A clause's last word: a comma, a semicolon or a colon. */
const CLAUSE_END = /[,;:]$/

/**
 * A review's line: its first sentence when it ends within `sentence`
 * words (whole, no ellipsis); else up to its last clause within `count`
 * words when that holds four or more; else `count` words with an ellipsis.
 */
export function firstLine(text: string, count: number, sentence: number): string {
  const words = text.trim().split(/\s+/)
  const end = words.findIndex((word) => SENTENCE_END.test(word))
  if (end >= 0 && end < sentence) {
    return words.slice(0, end + 1).join(" ")
  }
  if (words.length <= count) {
    return text.trim()
  }
  const head = words.slice(0, count)
  const clause = head.findLastIndex((word) => CLAUSE_END.test(word))
  if (clause >= 3) {
    return `${head
      .slice(0, clause + 1)
      .join(" ")
      .replace(/[,;:]$/, "")}…`
  }
  return excerpt(text, count)
}
