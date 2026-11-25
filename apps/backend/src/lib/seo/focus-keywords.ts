/**
 * A page's focus keywords in the one `seo_meta.focus_keyword` text column
 * (docs/13 §1, docs/14 KW-01): the primary first, the others after it,
 * joined by ", " — the form Rank Math keeps too, so an imported list reads
 * the same. A value written before the list (one keyword) is a list of one.
 * Pure; the panel keeps the same rules (features/seo/focus-keywords.ts).
 */

/** The most keywords a page keeps. */
export const FOCUS_KEYWORDS_MAX = 5

/** The longest single keyword, in characters (the AI task's own cap, too). */
export const FOCUS_KEYWORD_LENGTH = 60

const SEPARATOR = ", "

const folded = (keyword: string) => keyword.toLocaleLowerCase("tr")

/**
 * The stored text as keywords: split at commas, spaces collapsed, each cut
 * to its length, repeats (Turkish case folded) and empties dropped, at most
 * `FOCUS_KEYWORDS_MAX`, in their order (the first is the primary).
 */
export function parseFocusKeywords(raw: string | null | undefined): string[] {
  const keywords: string[] = []
  for (const part of (raw ?? "").split(",")) {
    const keyword = part.replace(/\s+/g, " ").trim().slice(0, FOCUS_KEYWORD_LENGTH).trim()
    if (
      keyword !== "" &&
      keywords.length < FOCUS_KEYWORDS_MAX &&
      !keywords.some((each) => folded(each) === folded(keyword))
    ) {
      keywords.push(keyword)
    }
  }
  return keywords
}

/** Keywords as the column keeps them; none is null. */
export function formatFocusKeywords(keywords: readonly string[]): string | null {
  const list = parseFocusKeywords(keywords.join(","))
  return list.length > 0 ? list.join(SEPARATOR) : null
}

/** The stored text in its normal form (an import, an API write); empty is null. */
export const normalizeFocusKeywords = (raw: string | null | undefined): string | null =>
  formatFocusKeywords(parseFocusKeywords(raw))

/** The primary keyword: the title, the slug and the H1 aim at it. */
export const primaryFocusKeyword = (raw: string | null | undefined): string | null =>
  parseFocusKeywords(raw)[0] ?? null
