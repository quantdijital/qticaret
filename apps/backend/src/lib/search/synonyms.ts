import { ValidationError } from "../errors"
import { isCleanText } from "../security/text"
import { wordsOf } from "./normalize"
import { MAX_SYNONYM_WORDS } from "./query"

/**
 * A synonym group's terms as kept (adr/0056): Turkish lower case, spaces
 * collapsed, each once as search compares them (`Tişört`, `TİŞÖRT` and
 * `tisort` are one term). A group holds two to MAX_GROUP_TERMS terms of
 * one to MAX_SYNONYM_WORDS words. A term search could never match (no
 * letter or digit: `!!!`, a blank) or holding what no shopper types
 * (control characters, lone surrogates) is refused, never dropped: a
 * group is kept as the shop wrote it or not at all. Each refusal is the
 * API's key with the term's place as its field (`terms.2`).
 */

export const MAX_GROUP_TERMS = 10

export function synonymTerms(terms: readonly string[]): string[] {
  const kept = new Map<string, string>()
  terms.forEach((term, index) => {
    const field = `terms.${String(index)}`
    const words = isCleanText(term) ? wordsOf(term) : []
    if (words.length === 0) {
      throw new ValidationError("search.synonym_term_invalid", { field })
    }
    if (words.length > MAX_SYNONYM_WORDS) {
      throw new ValidationError("search.synonym_term_too_long", { field })
    }
    const compared = words.map((word) => word.norm).join(" ")
    if (!kept.has(compared)) {
      kept.set(compared, words.map((word) => word.display).join(" "))
    }
  })
  if (kept.size < 2) {
    throw new ValidationError("search.synonym_terms_too_few", { field: "terms" })
  }
  if (kept.size > MAX_GROUP_TERMS) {
    throw new ValidationError("search.synonym_terms_too_many", { field: "terms" })
  }
  return [...kept.values()]
}
