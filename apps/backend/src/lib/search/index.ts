export { MAX_TERM_LENGTH, normalizeSearchTerm } from "./terms"
export {
  MAX_QUERY_LENGTH,
  MAX_QUERY_WORDS,
  foldWord,
  normalizeText,
  queryTerms,
  queryWords,
  wordsOf,
} from "./normalize"
export type { Word } from "./normalize"
export { MAX_SYNONYM_WORDS, hasDigit, readQuery, synonymMap } from "./query"
export type { QueryUnit, ReadQuery, SynonymMap } from "./query"
export {
  LEVEL,
  MAX_TYPOS,
  MIN_SIMILARITY,
  SHORT_WORD_SIMILARITY,
  leastSimilarity,
  rootCandidates,
  searchPlan,
  typosCouldHelp,
  unitPlan,
  wordsToAnalyse,
} from "./levels"
export type { Rank, SearchPlan, UnitPlan, WordFacts } from "./levels"
export { MAX_SUGGESTIONS, suggestionCandidates } from "./suggest"
export type { Suggestion, SuggestionWord } from "./suggest"
export { STEM_MARK, allOf, anyOf, enoughOf, followedBy, lexeme, stemLexeme } from "./tsquery"
export { searchFields, plainText } from "./document"
export type { SearchFields, SearchSource, FieldText } from "./document"
