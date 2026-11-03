import { hasDigit } from "./query"
import type { QueryUnit, ReadQuery } from "./query"
import { allOf, anyOf, enoughOf, followedBy, lexeme, stemLexeme } from "./tsquery"

/**
 * How a query unit is matched and weighed (adr/0056). Each way of finding
 * a word is its own `tsquery`, weighed by `ts_rank` over the index's
 * fields (title A, brand and categories B, attributes and options C,
 * description D) and by how good the way is: the same word over its
 * stem, a synonym, the start of a word, a word it starts with (a suffix
 * the stemmer missed), and last a typo (trigram neighbours, weighed by
 * how alike). A unit scores its best way. Pure: what the database knows
 * of each word comes in as `WordFacts`.
 */

/** A way's worth: exact > stem > synonym > prefix > root > typo (at most 0.5, by similarity). */
export const LEVEL = {
  exact: 1,
  stem: 0.9,
  synonym: 0.8,
  prefix: 0.7,
  root: 0.6,
  typo: 0.5,
} as const

/** Typo neighbours weighed per word: the closest. */
export const MAX_TYPOS = 4

/** pg_trgm similarity (Jaccard) a typo needs: Dice 0.4 from five letters, 0.5 below, as before. */
export const MIN_SIMILARITY = 0.25
export const SHORT_WORD_SIMILARITY = 1 / 3

/** What the index knows of a compared word (the analyse query). */
export interface WordFacts {
  /** Its Turkish stem without marks (`bıçakları` → `bicak`); null for a joining word. */
  stem: string | null
  /** Catalogue words it starts with, at least half of it and four letters (`kupalar` → `kupa`). */
  roots: string[]
  /** Catalogue words alike by trigrams, the most alike first, then the most common in titles. */
  alike: { word: string; display: string; similarity: number; titles: number }[]
  /** How the catalogue writes it (`şef`), when it is a catalogue word. */
  display: string | null
}

export interface Rank {
  query: string
  weight: number
}

export interface UnitPlan {
  /** Any way of finding the unit. */
  match: string
  ranks: Rank[]
}

export interface SearchPlan {
  units: UnitPlan[]
  /** What a product must match: every unit of one or two, all but one of more. */
  match: string
}

/** The least similarity a typo of the word needs; null when it takes none (short, a code). */
export function leastSimilarity(word: string): number | null {
  if (word.length < 3 || hasDigit(word)) {
    return null
  }
  return word.length >= 5 ? MIN_SIMILARITY : SHORT_WORD_SIMILARITY
}

/**
 * The words a word may be a suffixed form of: its starts of at least four
 * letters and half its length, the longest first. None for a code.
 */
export function rootCandidates(word: string): string[] {
  if (hasDigit(word)) {
    return []
  }
  const shortest = Math.max(4, Math.ceil(word.length / 2))
  const roots: string[] = []
  for (let length = word.length - 1; length >= shortest; length -= 1) {
    roots.push(word.slice(0, length))
  }
  return roots
}

const NONE: WordFacts = { stem: null, roots: [], alike: [], display: null }

// The word as itself or as its stem
const wordOrStem = (word: string, facts: WordFacts) =>
  anyOf([lexeme(word), ...(facts.stem && !hasDigit(word) ? [stemLexeme(facts.stem)] : [])])

/**
 * A way of several words side by side, weighed per word: `ts_rank` gives
 * two words found together more than one word alone, and a phrase way
 * must not outweigh the word itself.
 */
const perWord = (weight: number, words: readonly unknown[]) => weight / Math.max(1, words.length)

function synonymRanks(unit: QueryUnit, factsOf: (word: string) => WordFacts): Rank[] {
  return unit.synonyms.map((words) =>
    words.length === 1
      ? { query: wordOrStem(words[0] ?? "", factsOf(words[0] ?? "")), weight: LEVEL.synonym }
      : { query: followedBy(words), weight: perWord(LEVEL.synonym, words) }
  )
}

function wordRanks(unit: QueryUnit, facts: WordFacts, withTypos: boolean): Rank[] {
  const word = unit.words[0]?.norm ?? ""
  const ranks: Rank[] = [{ query: lexeme(word), weight: LEVEL.exact }]
  if (facts.stem && !hasDigit(word)) {
    ranks.push({ query: stemLexeme(facts.stem), weight: LEVEL.stem })
  }
  if (unit.last && word.length >= 2) {
    ranks.push({ query: lexeme(word, true), weight: LEVEL.prefix })
  }
  if (facts.roots.length > 0) {
    ranks.push({ query: anyOf(facts.roots.map((root) => lexeme(root))), weight: LEVEL.root })
  }
  const least = leastSimilarity(word)
  if (withTypos && least !== null) {
    for (const alike of typosOf(word, facts, least)) {
      ranks.push({ query: lexeme(alike.word), weight: LEVEL.typo * alike.similarity })
    }
  }
  return ranks
}

/** The typo neighbours a word is matched with: alike enough, not itself. */
export const typosOf = (word: string, facts: WordFacts, least: number | null) =>
  least === null
    ? []
    : facts.alike
        .filter((alike) => alike.word !== word && alike.similarity >= least)
        .slice(0, MAX_TYPOS)

/** How one unit is found and weighed. `withTypos`: its words' typo neighbours too. */
export function unitPlan(
  unit: QueryUnit,
  facts: ReadonlyMap<string, WordFacts>,
  withTypos: boolean
): UnitPlan {
  const factsOf = (word: string) => facts.get(word) ?? NONE
  const ranks =
    unit.words.length === 1
      ? wordRanks(unit, factsOf(unit.words[0]?.norm ?? ""), withTypos)
      : [
          {
            query: allOf(unit.words.map((word) => wordOrStem(word.norm, factsOf(word.norm)))),
            weight: perWord(LEVEL.exact, unit.words),
          },
        ]
  ranks.push(...synonymRanks(unit, factsOf))
  return { match: anyOf(ranks.map((rank) => rank.query)), ranks }
}

/** The whole query's plan; null when it has no words. */
export function searchPlan(
  read: ReadQuery,
  facts: ReadonlyMap<string, WordFacts>,
  withTypos: boolean
): SearchPlan | null {
  if (read.units.length === 0) {
    return null
  }
  const units = read.units.map((unit) => unitPlan(unit, facts, withTypos))
  return { units, match: enoughOf(units.map((unit) => unit.match)) }
}

/** Whether a second pass with typos could find more: some word has a neighbour alike enough. */
export function typosCouldHelp(read: ReadQuery, facts: ReadonlyMap<string, WordFacts>): boolean {
  return read.units.some((unit) =>
    unit.words.some(
      (word) =>
        typosOf(word.norm, facts.get(word.norm) ?? NONE, leastSimilarity(word.norm)).length > 0
    )
  )
}

/** Every compared word the database is asked about: the query's and its single-word synonyms'. */
export function wordsToAnalyse(read: ReadQuery): { norm: string; display: string }[] {
  const words = new Map<string, string>()
  for (const unit of read.units) {
    for (const word of unit.words) {
      words.set(word.norm, word.display)
    }
    for (const term of unit.synonyms) {
      const [only] = term
      if (term.length === 1 && only !== undefined && !words.has(only)) {
        words.set(only, only)
      }
    }
  }
  return [...words].map(([norm, display]) => ({ norm, display }))
}
