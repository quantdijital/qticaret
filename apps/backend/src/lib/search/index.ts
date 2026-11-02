export { MAX_TERM_LENGTH, normalizeSearchTerm } from "./terms"
export {
  MAX_QUERY_LENGTH,
  MAX_QUERY_WORDS,
  dice,
  foldWord,
  jaccard,
  normalizeText,
  queryWords,
  trigrams,
  wordsOf,
} from "./normalize"
export type { Word } from "./normalize"
export { DESCRIPTION_EXCERPT, FIELD_WEIGHTS, buildSearchIndex } from "./search-index"
export type { IndexedDoc, IndexedField, SearchDoc, SearchIndex } from "./search-index"
export { MATCH, MIN_SIMILARITY, matchQuality, searchIndex, wordQualities } from "./score"
export type { SearchHit } from "./score"
export { MAX_RELATED, MAX_SUGGESTIONS, RELATED_FROM_HITS, relatedTerms, suggest } from "./suggest"
export type { RelatedTerms } from "./suggest"
