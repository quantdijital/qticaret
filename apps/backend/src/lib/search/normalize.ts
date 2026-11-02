/**
 * Words as site search compares them (docs/20, adr/0046 ek 2026-11-03):
 * lower-cased the Turkish way (`İ` → `i`, `I` → `ı`), then without their
 * marks, so a shopper typing `cakı` or `bicak` on a keyboard without
 * Turkish letters finds `çakı` and `bıçak`. Anything that is not a letter
 * or a digit separates words. Pure, no locale data beyond `tr` casing.
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
 * A query's words to look for, as compared, each once, in order: joining
 * words (`ve`, `ile`, `için`) left out unless nothing else is left.
 */
export function queryWords(query: string): string[] {
  const all = [
    ...new Set(wordsOf(query.slice(0, MAX_QUERY_LENGTH)).map((word) => word.norm)),
  ].slice(0, MAX_QUERY_WORDS)
  const kept = all.filter((word) => !STOP_WORDS.has(word))
  return kept.length > 0 ? kept : all
}

/**
 * A word's distinct trigrams, padded as Postgres' pg_trgm pads them (two
 * spaces before, one after), so a word's start weighs more than its end.
 */
export function trigrams(word: string): string[] {
  const padded = `  ${word} `
  const grams = new Set<string>()
  for (let index = 0; index + 3 <= padded.length; index += 1) {
    grams.add(padded.slice(index, index + 3))
  }
  return [...grams]
}

const shared = (a: readonly string[], b: readonly string[]): number => {
  const [small, large] = a.length <= b.length ? [a, b] : [b, a]
  const set = new Set(large)
  let count = 0
  for (const gram of small) {
    if (set.has(gram)) {
      count += 1
    }
  }
  return count
}

/** Dice's coefficient of two distinct trigram lists: 2|A∩B| / (|A|+|B|), 0 to 1. */
export function dice(a: readonly string[], b: readonly string[]): number {
  const total = a.length + b.length
  return total === 0 ? 0 : (2 * shared(a, b)) / total
}

/** Jaccard's index of two distinct trigram lists: |A∩B| / |A∪B|, 0 to 1. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  const common = shared(a, b)
  const union = a.length + b.length - common
  return union === 0 ? 0 : common / union
}
