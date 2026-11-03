/**
 * Words as site search compares them (adr/0056): lower-cased the Turkish
 * way (`İ` → `i`, `I` → `ı`), then without their marks, so a shopper
 * typing `cakı` or `bicak` on a keyboard without Turkish letters finds
 * `çakı` and `bıçak`. Anything that is not a letter or a digit separates
 * words. The index stores words both ways: as typed for PostgreSQL's
 * Turkish stemmer, as compared for exact, prefix and trigram matching.
 * Pure, no locale data beyond `tr` casing.
 */

/** A word as typed (Turkish lower case, marks kept) and as compared. */
export interface Word {
  display: string
  norm: string
}

// ı has no decomposed form: NFD leaves it as it is
const DOTLESS = /ı/g
const MARKS = /\p{M}/gu
const WORD_CHAR = /^[\p{L}\p{N}\p{M}]$/u
const PLAIN = /^[a-z0-9]*$/

// Characters beyond ASCII looked up once; bounded, a query cannot grow it without end
const wordChars = new Map<number, boolean>()
const MAX_KNOWN_CHARS = 4096

const isWordChar = (code: number): boolean => {
  if (code < 0x80) {
    return (
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a)
    )
  }
  const known = wordChars.get(code)
  if (known !== undefined) {
    return known
  }
  const isWord = WORD_CHAR.test(String.fromCodePoint(code))
  if (wordChars.size < MAX_KNOWN_CHARS) {
    wordChars.set(code, isWord)
  }
  return isWord
}

/**
 * Runs of letters, digits and marks: a scan, four times faster than a
 * Unicode-class split on a catalogue's descriptions.
 */
function splitWords(text: string): string[] {
  const words: string[] = []
  let start = -1
  let index = 0
  while (index < text.length) {
    const code = text.codePointAt(index) ?? 0
    if (isWordChar(code)) {
      start = start < 0 ? index : start
    } else if (start >= 0) {
      words.push(text.slice(start, index))
      start = -1
    }
    index += code > 0xffff ? 2 : 1
  }
  if (start >= 0) {
    words.push(text.slice(start))
  }
  return words
}

/** One word without its marks: `bıçağı` → `bicagi`. */
export const foldWord = (word: string): string =>
  PLAIN.test(word)
    ? word
    : word.replace(DOTLESS, "i").normalize("NFD").replace(MARKS, "").normalize("NFC")

/** A text's words in order, each as typed and as compared; empty words dropped. */
export function wordsOf(text: string): Word[] {
  const words: Word[] = []
  for (const display of splitWords(text.normalize("NFKC").toLocaleLowerCase("tr"))) {
    const norm = foldWord(display)
    if (norm) {
      words.push({ display, norm })
    }
  }
  return words
}

/** A text as compared: `  ŞEF   Bıçağı! ` → `sef bicagi`. */
export const normalizeText = (text: string): string =>
  wordsOf(text)
    .map((word) => word.norm)
    .join(" ")

// Words that join others; a search of only these keeps them
const STOP_WORDS: ReadonlySet<string> = new Set(["ve", "ile", "icin", "veya", "ya", "bir"])

/** The longest query read and the most words weighed: a pasted paragraph is not a search. */
export const MAX_QUERY_LENGTH = 100
export const MAX_QUERY_WORDS = 8

/**
 * A query's words to look for, as typed and as compared, each once, in
 * order: joining words (`ve`, `ile`, `için`) left out unless nothing else
 * is left.
 */
export function queryTerms(query: string): Word[] {
  const seen = new Set<string>()
  const all: Word[] = []
  for (const word of wordsOf(query.slice(0, MAX_QUERY_LENGTH))) {
    if (!seen.has(word.norm)) {
      seen.add(word.norm)
      all.push(word)
    }
  }
  const read = all.slice(0, MAX_QUERY_WORDS)
  const kept = read.filter((word) => !STOP_WORDS.has(word.norm))
  return kept.length > 0 ? kept : read
}

/** A query's words to look for, as compared (`queryTerms`). */
export const queryWords = (query: string): string[] => queryTerms(query).map((word) => word.norm)
