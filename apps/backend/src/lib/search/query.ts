import { MAX_QUERY_LENGTH, normalizeText, queryTerms, wordsOf } from "./normalize"
import type { Word } from "./normalize"

/**
 * A search's words read into units (adr/0056): a word, or the words of a
 * synonym the shop set (`t shirt` ↔ `tişört`) found side by side. A unit
 * is found when any of its forms is: its own words, or an equal term of
 * its synonym groups. Pure: the synonyms come in, as `synonymMap` makes them.
 */

/** Words a synonym term may hold; longer phrases are not looked for in a query. */
export const MAX_SYNONYM_WORDS = 3

/** A compared term (`t shirt`) → the other terms of its groups, each as its compared words. */
export type SynonymMap = ReadonlyMap<string, readonly (readonly string[])[]>

export interface QueryUnit {
  words: Word[]
  /** Equal terms from the shop's synonyms, each as its compared words. */
  synonyms: string[][]
  /** The query's last unit, one word: matched as the start of a word too (as one types). */
  last: boolean
}

export interface ReadQuery {
  units: QueryUnit[]
  /** The query's words as compared, joining words left out (`bicak catal`). */
  words: Word[]
  /** The whole query as compared, joining words kept: a title equal to it or holding it is lifted. */
  phrase: string
}

/**
 * Synonym groups as a map: each term to every other term of the groups it
 * is in. A term of no words is left out, one longer than three too.
 */
export function synonymMap(groups: readonly (readonly string[])[]): SynonymMap {
  const map = new Map<string, Map<string, string[]>>()
  for (const group of groups) {
    const terms = group
      .map((term) => wordsOf(term).map((word) => word.norm))
      .filter((words) => words.length > 0 && words.length <= MAX_SYNONYM_WORDS)
    for (const term of terms) {
      const key = term.join(" ")
      const others = map.get(key) ?? new Map<string, string[]>()
      for (const other of terms) {
        const otherKey = other.join(" ")
        if (otherKey !== key) {
          others.set(otherKey, other)
        }
      }
      map.set(key, others)
    }
  }
  return new Map([...map].map(([key, others]) => [key, [...others.values()]]))
}

/** The query's words into units: the longest synonym term at each place first. */
export function readQuery(query: string, synonyms: SynonymMap = new Map()): ReadQuery {
  const words = queryTerms(query)
  const units: QueryUnit[] = []
  let at = 0
  while (at < words.length) {
    let size = Math.min(MAX_SYNONYM_WORDS, words.length - at)
    for (; size > 1; size -= 1) {
      const key = words
        .slice(at, at + size)
        .map((word) => word.norm)
        .join(" ")
      if (synonyms.has(key)) {
        break
      }
    }
    const span = words.slice(at, at + size)
    const key = span.map((word) => word.norm).join(" ")
    units.push({
      words: span,
      synonyms: (synonyms.get(key) ?? []).map((term) => [...term]),
      last: false,
    })
    at += size
  }
  const final = units.at(-1)
  if (final?.words.length === 1) {
    final.last = true
  }
  return { units, words, phrase: normalizeText(query.slice(0, MAX_QUERY_LENGTH)) }
}

/** Whether a word holds a digit: a code or a size, meant as written (no stem, no typo). */
export const hasDigit = (word: string): boolean => /\p{N}/u.test(word)
