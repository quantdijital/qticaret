/**
 * PostgreSQL `tsquery` values built from a query's words (adr/0056). Each
 * lexeme is quoted, so a word is never read as an operator, and the value
 * goes to the database as a bound parameter cast to `tsquery`: nothing a
 * shopper types becomes SQL. The words are already compared forms
 * (`normalize.ts`) or stems PostgreSQL returned; quoting still escapes a
 * quote or a backslash should one ever come.
 */

/** Stems sit in the index beside the words, marked so a word's prefix never meets them. */
export const STEM_MARK = "~"

/** One lexeme, as typed into the index; `prefix` also matches words that start with it. */
export function lexeme(word: string, prefix = false): string {
  const quoted = `'${word.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`
  return prefix ? `${quoted}:*` : quoted
}

/** A stem's lexeme (`~bicak`). */
export const stemLexeme = (stem: string): string => lexeme(`${STEM_MARK}${stem}`)

/** The words next to each other, in order. */
export const followedBy = (words: readonly string[]): string =>
  words.length === 1
    ? lexeme(words[0] ?? "")
    : `(${words.map((word) => lexeme(word)).join(" <-> ")})`

const joined = (parts: readonly string[], operator: "|" | "&"): string => {
  const kept = [...new Set(parts.filter(Boolean))]
  if (kept.length <= 1) {
    return kept[0] ?? ""
  }
  return `(${kept.join(` ${operator} `)})`
}

/** Any of the parts; empty parts left out, each part once. */
export const anyOf = (parts: readonly string[]): string => joined(parts, "|")

/** Every part. */
export const allOf = (parts: readonly string[]): string => joined(parts, "&")

/**
 * What a search needs found (adr/0056, as the in-memory search before it):
 * every unit of a query of one or two, all but one of a longer one.
 */
export function enoughOf(parts: readonly string[]): string {
  if (parts.length <= 2) {
    return allOf(parts)
  }
  return anyOf(parts.map((_, skipped) => allOf(parts.filter((__, at) => at !== skipped))))
}
