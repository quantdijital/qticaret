import { queryWords, trigrams } from "./normalize"
import type { SearchIndex } from "./search-index"

/**
 * A query weighed against an index (adr/0046 ek 2026-11-03). Each query
 * word against each catalogue word: the same word, the start of one
 * (`bıç` → `bıçak`), one it starts with (`bıçaklar` → `bıçak`, Turkish
 * suffixes), or one alike by trigrams (`katlnır` → `katlanır`); a word
 * with a digit (a code, a size) only as written or as the start of one. A product
 * scores, per query word, its best word of each field times the field's
 * weight, summed; a query of one or two words needs all of them, a longer
 * one all but one, and finding fewer scales the score down. The whole
 * query in the title adds a bonus.
 */

export interface SearchHit {
  id: string
  score: number
  /** The product's words the query found, as they read (Turkish lower case). */
  matched: string[]
}

/** A match's worth: exact > prefix > stem > fuzzy (at most 0.5, by similarity). */
export const MATCH = { exact: 1, prefix: 0.75, stem: 0.6, fuzzy: 0.5 } as const

/** The least trigram similarity (Dice) that is a typo of a word of five letters or more. */
export const MIN_SIMILARITY = 0.4
// Short words share fewer trigrams: `kupa` and `kuş` are 0.44 alike, and no typo of each other
const SHORT_WORD_SIMILARITY = 0.5
const PHRASE_BONUS = 2
const DIGIT = /\d/

/**
 * How well a query word matches a catalogue word; 0 when not at all. The
 * query's trigrams come as a set, made once for the whole vocabulary.
 */
export function matchQuality(
  query: string,
  queryGrams: ReadonlySet<string>,
  word: string,
  wordGrams: readonly string[]
): number {
  if (word === query) {
    return MATCH.exact
  }
  if (query.length >= 2 && word.startsWith(query)) {
    return MATCH.prefix
  }
  // A code or a size (`model123`, `20cm`) is meant as written: `model124` is another product
  if (DIGIT.test(query)) {
    return 0
  }
  // The query is the word with a suffix: at least half of it is the word
  if (word.length >= 4 && query.startsWith(word) && word.length * 2 >= query.length) {
    return MATCH.stem
  }
  if (query.length < 3) {
    return 0
  }
  const least = query.length >= 5 ? MIN_SIMILARITY : SHORT_WORD_SIMILARITY
  const total = queryGrams.size + wordGrams.length
  // The best Dice two lists of these lengths could reach
  if ((2 * Math.min(queryGrams.size, wordGrams.length)) / total < least) {
    return 0
  }
  let shared = 0
  for (const gram of wordGrams) {
    if (queryGrams.has(gram)) {
      shared += 1
    }
  }
  // Dice's coefficient (normalize.ts `dice`)
  const similarity = (2 * shared) / total
  return similarity >= least ? MATCH.fuzzy * similarity : 0
}

/**
 * The fewest letters a word needs for `matchQuality` to find it at all:
 * the query's own length (same word, or one it starts), half of it (a
 * stem), or the trigram count a typo's similarity needs (a word of n
 * letters has at most n + 1). Rounded down, so it never leaves one out.
 */
function shortestMatch(query: string, gramCount: number): number {
  let shortest = query.length
  if (!DIGIT.test(query)) {
    shortest = Math.min(shortest, Math.max(4, Math.ceil(query.length / 2)))
    if (query.length >= 3) {
      const least = query.length >= 5 ? MIN_SIMILARITY : SHORT_WORD_SIMILARITY
      shortest = Math.min(shortest, Math.floor((gramCount * least) / (2 - least)) - 1)
    }
  }
  return Math.max(1, shortest)
}

// The first word in a posting (shortest first) of at least that many letters
function firstOfLength(index: SearchIndex, posting: readonly number[], length: number): number {
  let low = 0
  let high = posting.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((index.words[posting[middle] ?? 0]?.length ?? 0) < length) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

/**
 * The words a query word may match, by id: those sharing a trigram with
 * it and long enough. The word's opening trigram (`  b`) is skipped: the
 * same word, a prefix or a stem shares its second (` bi`), and a typo
 * shares two or more (similarity at least 0.4 of six trigrams or more).
 * A long query word (a pasted string) so meets only the rare long words.
 */
export function candidateWords(index: SearchIndex, query: string): number[] {
  if (query.length < 2) {
    const id = index.ids.get(query)
    return id === undefined ? [] : [id]
  }
  const grams = trigrams(query)
  const shortest = shortestMatch(query, grams.length)
  const opening = `  ${query.slice(0, 1)}`
  const found = new Set<number>()
  for (const gram of grams) {
    const posting = gram === opening ? undefined : index.postings.get(gram)
    if (!posting) {
      continue
    }
    for (let at = firstOfLength(index, posting, shortest); at < posting.length; at += 1) {
      found.add(posting[at] ?? 0)
    }
  }
  return [...found]
}

/** A query word's match with every word of the index, by word id (0 for the words it cannot match). */
export function wordQualities(index: SearchIndex, query: string): Float64Array {
  const grams = new Set(trigrams(query))
  const qualities = new Float64Array(index.words.length)
  for (const id of candidateWords(index, query)) {
    qualities[id] = matchQuality(query, grams, index.words[id] ?? "", index.grams[id] ?? [])
  }
  return qualities
}

const rounded = (score: number) => Math.round(score * 1000) / 1000

/** The products the query finds, the best first; equals keep the index's order. */
export function searchIndex(index: SearchIndex, query: string): SearchHit[] {
  const words = queryWords(query)
  if (words.length === 0) {
    return []
  }
  const qualities = words.map((word) => wordQualities(index, word))
  const needed = words.length <= 2 ? words.length : words.length - 1
  const phrase = words.join(" ")
  const hits: SearchHit[] = []
  for (const entry of index.docs) {
    let score = 0
    let found = 0
    const matched = new Set<string>()
    for (const quality of qualities) {
      let wordScore = 0
      for (const field of entry.fields) {
        let best = 0
        let bestId = -1
        for (const id of field.words) {
          const each = quality[id] ?? 0
          if (each > best) {
            best = each
            bestId = id
          }
        }
        if (bestId >= 0) {
          wordScore += field.weight * best
          matched.add(index.display[bestId] ?? "")
        }
      }
      if (wordScore > 0) {
        found += 1
        score += wordScore
      }
    }
    if (found < needed) {
      continue
    }
    if (words.length > 1 && entry.title.includes(phrase)) {
      score += PHRASE_BONUS
    }
    hits.push({
      id: entry.doc.id,
      score: rounded((score * found) / words.length),
      matched: [...matched],
    })
  }
  // Array sort is stable: among equals the catalogue's own order (newest first) stays
  return hits.sort((a, b) => b.score - a.score)
}
