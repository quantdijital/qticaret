import { hasSymbolRun, isShouting, repeatedWord, words } from "../seo/advisor/text"
import { readsAsLink } from "../text/link-like"
import { hasPersonalData } from "./redact"
import {
  FOCUS_KEYWORD_MAX_COUNT,
  FOCUS_KEYWORD_MAX_LENGTH,
  FOCUS_KEYWORD_MAX_WORDS,
} from "./registry/catalog-tasks"
import { SHORT_DESCRIPTION_MAX_SENTENCES } from "./registry/product-page-tasks"

/**
 * The gates of the product page's short texts (registry/catalog-tasks.ts):
 * a focus keyword list and a product name. Both are shaped first (list
 * marks, labels and case a model adds are taken away, never refused for),
 * then checked; a problem means the suggestion is refused and not offered.
 */

// `NAME_MASK` as sent, or as a model may rewrite its ellipsis
const MASK_LEFT = /\[\s*(?:…|\.{3})\s*\]/
// A list mark at a line's start, a space after it: "1. ", "2) ", "- ", "•"; "2-li set" stays
const LIST_MARK = /^(?:\d{1,2}[.)]|[-*•–—])(?:\s+|$)/u
// A label before a colon ("Ana anahtar kelime: …"); a keyword holds no colon
const LABEL = /^[^:]{0,40}:\s*/u
// Quotes around a text and marks at its end: cut from the ends by a loop, never by a pattern
// (a `[…]+$` pattern backtracks on a long run in the middle of a text)
const QUOTE_CHARS = new Set(['"', "'", "“", "”", "«", "»", "‘", "’"])
const END_MARKS = new Set([".", "!", "?", "…"])

/** The text without `drop` characters at its start (`start`) and at its end; linear in the text. */
function cutEnds(text: string, drop: ReadonlySet<string>, start: boolean): string {
  let from = 0
  let to = text.length
  while (start && from < to && drop.has(text.charAt(from))) {
    from++
  }
  while (to > from && drop.has(text.charAt(to - 1))) {
    to--
  }
  return text.slice(from, to)
}

/** Quotes taken from both ends, then end marks from the end. */
const unquoted = (text: string): string =>
  cutEnds(cutEnds(text, QUOTE_CHARS, true), END_MARKS, false)
// What a search phrase is made of: letters, digits, spaces, a hyphen or an apostrophe
const KEYWORD_FORM = /^[\p{L}\p{N}][\p{L}\p{N}' -]*$/u

/**
 * A focus keyword answer as one keyword per line: list marks, labels,
 * quotes and end marks dropped, lower case (Turkish), spaces closed up,
 * repeats and anything past `FOCUS_KEYWORD_MAX_COUNT` left out. A line of
 * keywords split by commas is read as several.
 */
export function keywordLines(text: string): string[] {
  const seen = new Set<string>()
  for (const part of text.split(/[\n,;]/u)) {
    const keyword = unquoted(part.trim().replace(LIST_MARK, "").replace(LABEL, ""))
      .replace(/\s+/gu, " ")
      .trim()
      .toLocaleLowerCase("tr")
    if (keyword !== "") {
      seen.add(keyword)
    }
  }
  return [...seen].slice(0, FOCUS_KEYWORD_MAX_COUNT)
}

/** What is wrong with a shaped keyword list; an empty list passes. */
export function focusKeywordProblems(text: string): string[] {
  const lines = text.split("\n").filter((line) => line.trim() !== "")
  if (lines.length === 0) {
    return ["empty"]
  }
  const problems = new Set<string>()
  for (const line of lines) {
    const length = Array.from(line).length
    if (
      length < 2 ||
      length > FOCUS_KEYWORD_MAX_LENGTH ||
      words(line).length > FOCUS_KEYWORD_MAX_WORDS
    ) {
      problems.add("length")
    }
    if (!KEYWORD_FORM.test(line)) {
      problems.add("noise")
    }
    if (readsAsLink(line)) {
      problems.add("link")
    }
    if (hasPersonalData(line)) {
      problems.add("personal_data")
    }
    if (MASK_LEFT.test(line)) {
      problems.add("masked_name")
    }
  }
  return [...problems]
}

/** A product name as offered: quotes and an end mark dropped. */
export const productTitleText = (text: string): string => unquoted(text).trim()

/**
 * One line of a candidate list (adr/0074 §4) as offered: a list mark at
 * its start and quotes around it dropped; its own end mark stays (a
 * description ends its sentence).
 */
export const candidateLine = (line: string): string =>
  cutEnds(line.trim().replace(LIST_MARK, ""), QUOTE_CHARS, true).trim()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** Every text value of the data block (`{ "data": { … } }`), its keys left out. */
function dataTexts(data: string): string[] {
  let block: unknown
  try {
    block = JSON.parse(data)
  } catch {
    return []
  }
  const texts: string[] = []
  const walk = (value: unknown, depth: number) => {
    if (typeof value === "string") {
      texts.push(value)
    } else if (depth < 4 && isRecord(value)) {
      for (const each of Object.values(value)) {
        walk(each, depth + 1)
      }
    }
  }
  walk(isRecord(block) ? block["data"] : null, 0)
  return texts
}

// Joining words a name may add without inventing anything
const JOINERS = new Set(["ve", "ile", "için", "veya", "ya", "da", "de", "bir"])
// The letters two words share at the start to count as one (Turkish adds its endings: gömlek, gömleği)
const STEM = 5

/**
 * The words of `text` the data block does not hold: a word with a digit
 * must be there as it is (a size, a model number), a word of three
 * letters or more must share its start with one there; joining words and
 * shorter ones pass. Empty: every word comes from the facts.
 */
export function ungroundedWords(text: string, data: string): string[] {
  const known = new Set(dataTexts(data).flatMap(words))
  const stems = [...known].filter((word) => word.length >= 3 && !/\p{N}/u.test(word))
  return words(text).filter((word) => {
    if (/\p{N}/u.test(word)) {
      return !known.has(word)
    }
    if (word.length < 3 || JOINERS.has(word) || known.has(word)) {
      return false
    }
    return !stems.some((each) => {
      const shared = Math.min(STEM, word.length, each.length)
      return word.slice(0, shared) === each.slice(0, shared)
    })
  })
}

/**
 * What is wrong with a product name: a second line, shouting or a word
 * said thrice, a link, a person's data, a masked name, and any word the
 * product's facts do not hold (`ungrounded`: no invented feature).
 */
export function productTitleProblems(text: string, data: string | undefined): string[] {
  const problems: string[] = []
  if (text.includes("\n")) {
    problems.push("lines")
  }
  if (Array.from(text).length < 3) {
    problems.push("length")
  }
  if (isShouting(text) || hasSymbolRun(text) || repeatedWord(text) !== null) {
    problems.push("noise")
  }
  if (readsAsLink(text)) {
    problems.push("link")
  }
  if (hasPersonalData(text)) {
    problems.push("personal_data")
  }
  if (MASK_LEFT.test(text)) {
    problems.push("masked_name")
  }
  // No facts to hold it against: nothing can show the name invents nothing
  if (data === undefined || ungroundedWords(text, data).length > 0) {
    problems.push("ungrounded")
  }
  return problems
}

// A sentence's end: its marks, then a space and a capital letter ("3.5 cm", "vb. ürünler" do not end one)
const SENTENCE_END = /[.!?…]+\s+(?=\p{Lu})/gu

/** Sentences in a text, as a reader counts them: one, and one more for each end inside it. */
export const sentenceCount = (text: string): number =>
  text.trim() === "" ? 0 : 1 + (text.trim().match(SENTENCE_END)?.length ?? 0)

/**
 * What is wrong with a short description's own shape: a second line
 * (it is one paragraph) or more sentences than it holds. What every text
 * is checked for (a link, a person's data, shouting) is the gate's own.
 */
export function shortDescriptionProblems(text: string): string[] {
  const problems: string[] = []
  if (text.includes("\n")) {
    problems.push("lines")
  }
  if (sentenceCount(text) > SHORT_DESCRIPTION_MAX_SENTENCES) {
    problems.push("sentences")
  }
  return problems
}
