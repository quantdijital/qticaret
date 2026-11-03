import { wordsOf } from "./normalize"
import type { Word } from "./normalize"

/**
 * A product as the search index holds it (adr/0056): its words in four
 * weights, each written twice: as typed (Turkish lower case, marks kept)
 * for PostgreSQL's Turkish stemmer, and as compared (marks folded) for
 * exact, prefix and code matching. A: title, SKUs, barcodes, MPNs; B:
 * brand and shown categories; C: subtitle, public attribute values,
 * option values, variant titles, tags, type; D: the plain description.
 * Each field holds a word once, so twenty variants named "Kırmızı" count
 * as one. Pure.
 */

/** What the index reads of a product, gathered by the indexing workflow. */
export interface SearchSource {
  title: string
  /** SKUs, barcodes (EAN, UPC), MPNs: found as written, and with their separators left out. */
  codes: string[]
  brand: string | null
  /** The categories the shop shows. */
  categories: string[]
  subtitle: string | null
  /** Public attribute values as a shopper reads them ("Paslanmaz Çelik", "20 cm"). */
  attributes: string[]
  options: string[]
  variants: string[]
  tags: string[]
  type: string | null
  /** Plain text or simple HTML. */
  description: string | null
}

export interface FieldText {
  /** As typed: words joined by spaces. */
  m: string
  /** As compared. */
  f: string
}

export interface SearchFields {
  a: FieldText
  b: FieldText
  c: FieldText
  d: FieldText
}

export interface SearchText {
  fields: SearchFields
  /** The title as compared, for the exact-title and phrase lifts. */
  title: string
  /** Each distinct word once: as compared, as it reads (a title's spelling first), in a title. */
  vocabulary: [string, string, boolean][]
}

/** Characters of the description indexed: all a product page says, a pasted manual not. */
export const DESCRIPTION_CHARS = 4000
/** Words a field holds at most, and the vocabulary a product adds. */
const FIELD_WORDS = 600
const VOCABULARY_WORDS = 800

const TAGS = /<[^>]*>|&[a-z]+;|&#\d+;/gi
// A tag or entity the cut left open at its end
const CUT_OPEN = /<[^>]*$|&#?[a-z\d]*$/i

/** A description as plain text, its first DESCRIPTION_CHARS characters, tags and entities left out. */
export function plainText(text: string | null | undefined): string {
  const whole = text ?? ""
  const read = whole.slice(0, DESCRIPTION_CHARS * 2)
  return (read.length < whole.length ? read.replace(CUT_OPEN, "") : read)
    .replace(TAGS, " ")
    .slice(0, DESCRIPTION_CHARS)
}

function distinctWords(texts: readonly (string | null | undefined)[]): Word[] {
  const seen = new Set<string>()
  const words: Word[] = []
  for (const text of texts) {
    for (const word of wordsOf(text ?? "")) {
      if (!seen.has(word.display) && words.length < FIELD_WORDS) {
        seen.add(word.display)
        words.push(word)
      }
    }
  }
  return words
}

const fieldOf = (words: readonly Word[], extra: readonly string[] = []): FieldText => ({
  m: words.map((word) => word.display).join(" "),
  f: [...new Set([...words.map((word) => word.norm), ...extra])].join(" "),
})

/** A code's words and, when it has several, the code with its separators left out (`kupamavi01`). */
function codeWords(codes: readonly string[]): string[] {
  const found: string[] = []
  for (const code of codes) {
    const words = wordsOf(code).map((word) => word.norm)
    found.push(...words)
    if (words.length > 1) {
      found.push(words.join(""))
    }
  }
  return [...new Set(found)]
}

export function searchFields(source: SearchSource): SearchText {
  const title = wordsOf(source.title)
  const codes = codeWords(source.codes)
  const b = distinctWords([source.brand, ...source.categories])
  const c = distinctWords([
    source.subtitle,
    ...source.attributes,
    ...source.options,
    ...source.variants,
    ...source.tags,
    source.type,
  ])
  const d = distinctWords([plainText(source.description)])
  const vocabulary = new Map<string, [string, string, boolean]>()
  for (const word of title) {
    vocabulary.set(word.norm, [word.norm, word.display, true])
  }
  for (const word of [...codes.map((norm) => ({ norm, display: norm })), ...b, ...c, ...d]) {
    if (!vocabulary.has(word.norm) && vocabulary.size < VOCABULARY_WORDS) {
      vocabulary.set(word.norm, [word.norm, word.display, false])
    }
  }
  return {
    fields: {
      a: {
        m: title.map((word) => word.display).join(" "),
        f: [...title.map((word) => word.norm), ...codes].join(" "),
      },
      b: fieldOf(b),
      c: fieldOf(c),
      d: fieldOf(d),
    },
    title: title.map((word) => word.norm).join(" "),
    vocabulary: [...vocabulary.values()],
  }
}
