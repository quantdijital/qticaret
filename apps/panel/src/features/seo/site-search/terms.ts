/**
 * A synonym group's terms as site search keeps them (adr/0056), checked
 * here as the server checks them so the dialog says what the server would
 * refuse before saving. Turkish lower case; anything that is not a letter
 * or a digit separates words; a term is one to three words and at most 60
 * characters; a group holds each term once as search compares it
 * (`Tişört` and `tisort` are one: a repeat is passed over), two to ten of
 * them.
 */

export const MIN_GROUP_TERMS = 2
export const MAX_GROUP_TERMS = 10
export const MAX_TERM_WORDS = 3
export const MAX_TERM_LENGTH = 60

const WORD = /[\p{L}\p{N}\p{M}]+/gu
const MARKS = /\p{M}/gu
const DOTLESS = /ı/g

/** A word as search compares it: `bıçağı` → `bicagi`. */
const fold = (word: string): string =>
  word.replace(DOTLESS, "i").normalize("NFD").replace(MARKS, "").normalize("NFC")

/** A term's words, Turkish lower case: `T-Shirt` → `["t", "shirt"]`. */
export function termWords(text: string): string[] {
  const words = text.normalize("NFKC").toLocaleLowerCase("tr").match(WORD) ?? []
  return words.filter((word) => fold(word) !== "")
}

/** A term as search compares it, to find the same term written twice. */
export const comparedTerm = (text: string): string => termWords(text).map(fold).join(" ")

/** What the server would refuse: only these stop a term. */
export type TermProblem = "noWords" | "words" | "length" | "full"

export type TermCheck =
  /** `already`: the group has it as search compares it; nothing to add, nothing wrong. */
  { ok: true; term: string; already?: true } | { ok: false; problem: TermProblem }

/** One typed term against the group so far: the term as kept, or why the server would refuse it. */
export function checkTerm(text: string, group: readonly string[]): TermCheck {
  const words = termWords(text)
  if (words.length === 0) {
    return { ok: false, problem: "noWords" }
  }
  if (words.length > MAX_TERM_WORDS) {
    return { ok: false, problem: "words" }
  }
  const term = words.join(" ")
  if (term.length > MAX_TERM_LENGTH) {
    return { ok: false, problem: "length" }
  }
  const compared = comparedTerm(term)
  const same = group.find((kept) => comparedTerm(kept) === compared)
  // The server keeps each term once anyway: a repeat is let through, not refused
  if (same !== undefined) {
    return { ok: true, term: same, already: true }
  }
  if (group.length >= MAX_GROUP_TERMS) {
    return { ok: false, problem: "full" }
  }
  return { ok: true, term }
}

export interface Added {
  group: string[]
  /** What stays in the field: the refused term and anything typed after it. */
  rest: string
  problem: TermProblem | null
}

/**
 * The typed text (one term, or several split by commas) added to the
 * group in order; a term the group already has is passed over; the first
 * term the server would refuse stops it and stays to be fixed.
 */
export function addTerms(text: string, group: readonly string[]): Added {
  const pieces = text
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean)
  const next = [...group]
  for (const [index, piece] of pieces.entries()) {
    const checked = checkTerm(piece, next)
    if (!checked.ok) {
      return { group: next, rest: pieces.slice(index).join(", "), problem: checked.problem }
    }
    if (!checked.already) {
      next.push(checked.term)
    }
  }
  return { group: next, rest: "", problem: null }
}

const SERVER_KEYS: Readonly<Record<string, string>> = {
  "search.synonym_terms_too_few": "tooFew",
  "search.synonym_term_too_long": "words",
  "search.synonym_term_length": "length",
  "search.synonym_terms_too_many": "full",
  "search.synonyms_too_many": "groupsFull",
  "search.synonym_unknown": "unknown",
  "search.synonym_term_invalid": "invalid",
}
const KEY = /\bsearch\.[a-z_]+/

/**
 * The server's refusal of a group as this screen's text key, or null for
 * any other failure. The key is in `code`, is the message itself, or is
 * named in the general sentence the server sends for a key it has no
 * sentence for ("… (hata kodu: search.synonyms_too_many).").
 */
export function synonymProblemOf(error: unknown): string | null {
  const failure = error as { code?: unknown; message?: unknown } | null
  for (const value of [failure?.code, failure?.message]) {
    const key = typeof value === "string" ? KEY.exec(value)?.[0] : undefined
    const name = key === undefined ? undefined : SERVER_KEYS[key]
    if (name) {
      return name
    }
  }
  return null
}
