/**
 * A page's focus keywords in the one `focus_keyword` text the server keeps
 * (docs/13 §3): the primary first, joined by ", ". A value from before the
 * list (one keyword) is a list of one. The server keeps the same rules
 * (backend lib/seo/focus-keywords.ts).
 */

/** The most keywords a page keeps. */
export const FOCUS_KEYWORDS_MAX = 5

/** The longest single keyword, in characters. */
export const FOCUS_KEYWORD_LENGTH = 60

const folded = (keyword: string) => keyword.toLocaleLowerCase("tr")

const clean = (text: string) => text.replace(/\s+/g, " ").trim()

/** The stored text as keywords, in their order: repeats and empties dropped, five at most. */
export function parseFocusKeywords(raw: string | null | undefined): string[] {
  return addFocusKeywords([], raw ?? "").keywords
}

/** Keywords as the server keeps them; none is the empty text (the card saves it as null). */
export const formatFocusKeywords = (keywords: readonly string[]): string => keywords.join(", ")

/** Why some of the typed text did not become a keyword: the list was full, or one was cut. */
export type FocusKeywordNote = "limit" | "length" | null

/**
 * The typed text added to the list: split at commas (a pasted "a, b, c"
 * is three), each trimmed and cut to its length, a repeat (Turkish case
 * folded) left out. Past five, the rest is dropped and the note says so.
 */
export function addFocusKeywords(
  keywords: readonly string[],
  text: string
): { keywords: string[]; note: FocusKeywordNote } {
  const next = [...keywords]
  let note: FocusKeywordNote = null
  for (const part of text.split(",")) {
    const typed = clean(part)
    if (typed === "") {
      continue
    }
    const keyword = clean(typed.slice(0, FOCUS_KEYWORD_LENGTH))
    if (next.some((each) => folded(each) === folded(keyword))) {
      continue
    }
    if (next.length >= FOCUS_KEYWORDS_MAX) {
      note = "limit"
      continue
    }
    if (keyword.length < typed.length) {
      note = note ?? "length"
    }
    next.push(keyword)
  }
  return { keywords: next, note }
}

/** The keyword at `index` made the primary; the others keep their order. */
export function makePrimary(keywords: readonly string[], index: number): string[] {
  const keyword = keywords[index]
  if (keyword === undefined || index === 0) {
    return [...keywords]
  }
  return [keyword, ...keywords.filter((_, at) => at !== index)]
}

/** A suggested keyword added: the primary when there is none, else after the others. */
export const withSuggested = (keywords: readonly string[], suggested: string): string[] =>
  addFocusKeywords(keywords, suggested.replace(/,/g, " ")).keywords

/** The list in a few words: the primary, and how many more ("çelik termos +2"). */
export function focusKeywordsShort(keywords: readonly string[]): string {
  const [primary, ...others] = keywords
  if (primary === undefined) {
    return ""
  }
  return others.length > 0 ? `${primary} +${String(others.length)}` : primary
}
