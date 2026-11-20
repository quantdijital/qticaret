/**
 * Words named inside a system message in our own quotes: a word with a
 * quote mark of its own cannot close ours early and read on as an
 * instruction, so the marks are taken out first (#247 B1).
 */

const QUOTE_MARKS = /["“”„«»'‘’`]/g

/** The word without quote marks, spaces folded; empty when nothing else was in it. */
export const unquoted = (word: string): string =>
  word.replace(QUOTE_MARKS, "").replace(/\s+/gu, " ").trim()

/** Each word in quotes: “ayna”, “altın”; a word of quote marks only is left out. */
export const quoted = (words: readonly string[]): string =>
  words
    .map(unquoted)
    .filter((word) => word !== "")
    .map((word) => `“${word}”`)
    .join(", ")
