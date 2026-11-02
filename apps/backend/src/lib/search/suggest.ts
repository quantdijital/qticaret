import { queryWords, wordsOf } from "./normalize"
import { MATCH, wordQualities } from "./score"
import type { SearchHit } from "./score"
import type { SearchIndex } from "./search-index"

/**
 * "Did you mean" and the chips beside the results (adr/0046 ek
 * 2026-11-03). A query is weak when one of its words is no catalogue word
 * nor the start or stem of one: only typos of it match. Each such word is
 * then offered as the title words most alike, the most common first, and
 * the phrases made of them are kept only if some product holds all their
 * words.
 */

export const MAX_SUGGESTIONS = 5
const CANDIDATES_PER_WORD = 3

/** Hits read for the related chips: about the first two pages. */
export const RELATED_FROM_HITS = 48
export const MAX_RELATED = 5

interface QueryWord {
  norm: string
  display: string
  /** The title words it may have meant, best first; null when it is a known word. */
  candidates: number[] | null
}

function readWord(index: SearchIndex, norm: string, display: string): QueryWord {
  const qualities = wordQualities(index, norm)
  const alike: number[] = []
  for (let id = 0; id < qualities.length; id += 1) {
    const quality = qualities[id] ?? 0
    if (quality >= MATCH.stem) {
      return { norm, display, candidates: null }
    }
    if (quality > 0 && (index.titleCount[id] ?? 0) > 0) {
      alike.push(id)
    }
  }
  alike.sort(
    (a, b) =>
      (qualities[b] ?? 0) - (qualities[a] ?? 0) ||
      (index.titleCount[b] ?? 0) - (index.titleCount[a] ?? 0)
  )
  return { norm, display, candidates: alike.slice(0, CANDIDATES_PER_WORD) }
}

/** Whether some product holds every word of the phrase that is a catalogue word. */
function findsSomething(index: SearchIndex, ids: number[]): boolean {
  return index.docs.some((entry) => ids.every((id) => entry.all.has(id)))
}

/**
 * Up to five phrases the query may have meant, best first; none when every
 * word of it is the catalogue's own (the query is not weak).
 */
export function suggest(query: string, index: SearchIndex): string[] {
  const typed = new Map<string, string>()
  for (const word of wordsOf(query)) {
    if (!typed.has(word.norm)) {
      typed.set(word.norm, word.display)
    }
  }
  const words = queryWords(query).map((norm) => readWord(index, norm, typed.get(norm) ?? norm))
  if (words.every((word) => word.candidates === null)) {
    return []
  }
  // A known word stays; one with nothing alike is left out
  const kept = words.filter((word) => word.candidates === null || word.candidates.length > 0)
  const choice = kept.map(() => 0)
  const variants: number[][] = [choice]
  kept.forEach((word, position) => {
    for (let rank = 1; rank < (word.candidates?.length ?? 0); rank += 1) {
      variants.push(choice.map((each, at) => (at === position ? rank : each)))
    }
  })
  const own = queryWords(query).join(" ")
  const phrases: string[] = []
  for (const variant of variants) {
    const ids: number[] = []
    const shown = kept.map((word, position) => {
      const id = word.candidates?.[variant[position] ?? 0]
      if (id === undefined) {
        // A catalogue word reads as the catalogue writes it: `sef` → `şef`
        const exact = index.ids.get(word.norm)
        if (exact === undefined) {
          return word.display
        }
        ids.push(exact)
        return index.display[exact] ?? word.display
      }
      ids.push(id)
      return index.display[id] ?? ""
    })
    const phrase = shown.join(" ")
    const compared = wordsOf(phrase)
      .map((word) => word.norm)
      .join(" ")
    if (compared && compared !== own && !phrases.includes(phrase) && findsSomething(index, ids)) {
      phrases.push(phrase)
    }
    if (phrases.length === MAX_SUGGESTIONS) {
      break
    }
  }
  return phrases
}

export interface RelatedTerms {
  categories: { id: string; name: string }[]
  brands: { id: string; name: string; handle: string }[]
}

/** The categories and brands most of the first hits are in, the most common first. */
export function relatedTerms(
  hits: readonly SearchHit[],
  index: SearchIndex,
  limit = MAX_RELATED
): RelatedTerms {
  const categories = new Map<string, { value: { id: string; name: string }; count: number }>()
  const brands = new Map<
    string,
    { value: { id: string; name: string; handle: string }; count: number }
  >()
  for (const hit of hits.slice(0, RELATED_FROM_HITS)) {
    const doc = index.byId.get(hit.id)?.doc
    for (const category of doc?.categories ?? []) {
      const entry = categories.get(category.id) ?? { value: category, count: 0 }
      entry.count += 1
      categories.set(category.id, entry)
    }
    if (doc?.brand) {
      const entry = brands.get(doc.brand.id) ?? { value: doc.brand, count: 0 }
      entry.count += 1
      brands.set(doc.brand.id, entry)
    }
  }
  // Map order is first seen: among equals the better hit's comes first
  const top = <T>(entries: Map<string, { value: T; count: number }>) =>
    [...entries.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((entry) => entry.value)
  return {
    categories: top(categories).map(({ id, name }) => ({ id, name })),
    brands: top(brands).map(({ id, name, handle }) => ({ id, name, handle })),
  }
}
