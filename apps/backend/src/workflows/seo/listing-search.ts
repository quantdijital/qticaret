import type { MedusaContainer } from "@medusajs/framework/types"
import {
  MAX_SUGGESTIONS,
  anyOf,
  hasDigit,
  leastSimilarity,
  lexeme,
  readQuery,
  rootCandidates,
  searchPlan,
  stemLexeme,
  suggestionCandidates,
  typosCouldHelp,
  wordsToAnalyse,
} from "../../lib/search"
import type { ReadQuery, SearchPlan, WordFacts } from "../../lib/search"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import type { ListingPlan, ListingResult } from "../../modules/search-index/types"

/**
 * Site search as a listing (`/arama`, adr/0056): the catalogue's index
 * matched against the query in PostgreSQL full text, its filters, facets
 * and pages in the same statement. The words are read once (stems,
 * the catalogue's spelling, roots, typo neighbours); a first pass finds
 * the query's words, stems, synonyms and starts; when it finds fewer than
 * FEW_RESULTS, a second pass takes typos too. "Did you mean" offers the
 * catalogue's words for those the catalogue does not hold.
 */

/** The listing type of a search; its id is the query as compared. */
export const SEARCH_LISTING = "search"

/** Fewer hits than this, and the query's typo neighbours are searched too. */
export const FEW_RESULTS = 3

/** Hits read for the related chips: about the first two pages. */
export const RELATED_FROM_HITS = 48

export interface RelatedTerms {
  categories: { id: string; name: string }[]
  brands: { id: string; name: string; handle: string }[]
}

/** What the answer adds for a search. */
export interface ListingSearch {
  /** "Did you mean": up to five phrases, when a word of the query is no catalogue word. */
  suggestions: string[]
  /** Chips: the categories and brands most hits are in. */
  related: RelatedTerms
  took_ms: number
}

const index = (container: MedusaContainer) =>
  container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)

async function wordFacts(
  container: MedusaContainer,
  read: ReadQuery
): Promise<Map<string, WordFacts>> {
  const analysed = await index(container).analyseWords(
    wordsToAnalyse(read).map((word) => ({
      ...word,
      roots: rootCandidates(word.norm),
      least: leastSimilarity(word.norm),
    }))
  )
  return new Map(analysed.map(({ norm, ...facts }) => [norm, facts]))
}

const withText = (base: ListingPlan, plan: SearchPlan, read: ReadQuery): ListingPlan => ({
  ...base,
  text: {
    match: plan.match,
    units: plan.units.map((unit) => unit.ranks),
    phrase: read.phrase,
  },
  related: RELATED_FROM_HITS,
})

/**
 * Whether some product holds each query word: as itself, its stem, a word
 * it starts, or a word it starts with. A word with synonyms counts as held.
 */
async function knownWords(
  container: MedusaContainer,
  read: ReadQuery,
  facts: ReadonlyMap<string, WordFacts>,
  channels: string[] | null
): Promise<boolean[]> {
  const withSynonyms = new Set(
    read.units.flatMap((unit) =>
      unit.synonyms.length > 0 ? unit.words.map((word) => word.norm) : []
    )
  )
  const queries = read.words.map((word) => {
    const own = facts.get(word.norm)
    return anyOf([
      lexeme(word.norm),
      ...(word.norm.length >= 2 ? [lexeme(word.norm, true)] : []),
      ...(own?.stem && !hasDigit(word.norm) ? [stemLexeme(own.stem)] : []),
      ...(own?.roots ?? []).map((root) => lexeme(root)),
    ])
  })
  const found = await index(container).matchesAny(queries, channels)
  return read.words.map((word, at) => withSynonyms.has(word.norm) || found[at] === true)
}

async function suggestionsOf(
  container: MedusaContainer,
  read: ReadQuery,
  facts: ReadonlyMap<string, WordFacts>,
  channels: string[] | null
): Promise<string[]> {
  const known = await knownWords(container, read, facts, channels)
  const candidates = suggestionCandidates(
    read.words.map((word, at) => ({ ...word, known: known[at] === true })),
    facts
  )
  if (candidates.length === 0) {
    return []
  }
  const found = await index(container).matchesAny(
    candidates.map((candidate) => candidate.query),
    channels
  )
  return candidates
    .filter((_, at) => found[at] === true)
    .slice(0, MAX_SUGGESTIONS)
    .map((candidate) => candidate.phrase)
}

const EMPTY_RELATED: RelatedTerms = { categories: [], brands: [] }

/** A search's page, facets and chips, and its suggestions. */
export async function searchListing(
  container: MedusaContainer,
  base: ListingPlan,
  query: string
): Promise<{ result: ListingResult | null; suggestions: string[]; related: RelatedTerms }> {
  const read = readQuery(query, await index(container).synonymMap())
  const facts = await wordFacts(container, read)
  const first = searchPlan(read, facts, false)
  if (!first) {
    return { result: null, suggestions: [], related: EMPTY_RELATED }
  }
  let result = await index(container).listing(withText(base, first, read))
  if (result.count < FEW_RESULTS && typosCouldHelp(read, facts)) {
    const second = searchPlan(read, facts, true)
    if (second) {
      result = await index(container).listing(withText(base, second, read))
    }
  }
  return {
    result,
    suggestions: await suggestionsOf(container, read, facts, base.channels),
    related: result.related ?? EMPTY_RELATED,
  }
}
