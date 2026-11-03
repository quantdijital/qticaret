import type { Word } from "./normalize"
import { leastSimilarity, typosOf } from "./levels"
import type { WordFacts } from "./levels"
import { allOf, lexeme } from "./tsquery"

/**
 * "Did you mean" (adr/0056, as adr/0046 ek 2026-11-03 had it). A query is
 * weak when one of its words is found in no product, neither as itself,
 * its stem, the start of a word nor a word it starts with: only typos of
 * it could match. Each such word is offered as the title words most alike,
 * the most common first; the phrases made of them are kept only when some
 * product holds all their words (the caller asks the index). Pure.
 */

export const MAX_SUGGESTIONS = 5
const CANDIDATES_PER_WORD = 3

export interface SuggestionWord extends Word {
  /** Some product holds it (as itself, its stem, a word it starts or one it starts with). */
  known: boolean
}

export interface Suggestion {
  /** As shown: the catalogue's own spelling (`şef bıçağı`). */
  phrase: string
  /** What some product must hold for it to be offered. */
  query: string
}

// The title words a weak word may have meant, best first
function candidatesOf(word: SuggestionWord, facts: WordFacts | undefined) {
  if (!facts) {
    return []
  }
  return typosOf(word.norm, facts, leastSimilarity(word.norm))
    .filter((alike) => alike.titles > 0)
    .slice(0, CANDIDATES_PER_WORD)
}

/**
 * The phrases to check, best first; none when every word is the
 * catalogue's own. A known word stays as the catalogue writes it; a weak
 * one with nothing alike is left out.
 */
export function suggestionCandidates(
  words: readonly SuggestionWord[],
  facts: ReadonlyMap<string, WordFacts>
): Suggestion[] {
  if (words.every((word) => word.known)) {
    return []
  }
  const kept = words
    .map((word) => ({
      word,
      candidates: word.known ? null : candidatesOf(word, facts.get(word.norm)),
    }))
    .filter((entry) => entry.candidates === null || entry.candidates.length > 0)
  const base = kept.map(() => 0)
  const variants: number[][] = [base]
  kept.forEach((entry, position) => {
    for (let rank = 1; rank < (entry.candidates?.length ?? 0); rank += 1) {
      variants.push(base.map((each, at) => (at === position ? rank : each)))
    }
  })
  const own = words.map((word) => word.norm).join(" ")
  const seen = new Set<string>()
  const suggestions: Suggestion[] = []
  for (const variant of variants) {
    const chosen = kept.map((entry, position) => {
      const candidate = entry.candidates?.[variant[position] ?? 0]
      if (candidate) {
        return { norm: candidate.word, shown: candidate.display, held: true }
      }
      // A known word reads as the catalogue writes it (`sef` → `şef`); one known
      // only by its stem or start is not asked for as itself
      const display = facts.get(entry.word.norm)?.display ?? null
      return { norm: entry.word.norm, shown: display ?? entry.word.display, held: display !== null }
    })
    const compared = chosen.map((each) => each.norm).join(" ")
    const phrase = chosen.map((each) => each.shown).join(" ")
    const held = chosen.filter((each) => each.held).map((each) => lexeme(each.norm))
    if (compared && compared !== own && held.length > 0 && !seen.has(phrase)) {
      seen.add(phrase)
      suggestions.push({ phrase, query: allOf(held) })
    }
  }
  return suggestions
}
