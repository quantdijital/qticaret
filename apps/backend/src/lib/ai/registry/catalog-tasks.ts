import type { AiTask } from "./tasks"

/**
 * The product page's short-text tasks (docs/22 "Ürün ekranı genişletme 1"):
 * a focus keyword with its alternatives, and a clearer product name. Kept
 * apart from `tasks.ts` for its length; registered there, in its order.
 */

/**
 * Candidates a short text task asks for in one call (adr/0074 §4): each
 * passes the gate on its own, those that pass are offered in order.
 */
export const AI_CANDIDATE_COUNT = 3

/** Sampling temperatures (adr/0074 §4); sent only to a target documented to take one. */
export const AI_TEMPERATURE = {
  /** Short search texts: varied candidates. */
  short: 0.7,
  /** Long text written for shoppers. */
  long: 0.8,
  /** Texts held close to the record (a summary, an answer, an alt text). */
  factual: 0.4,
  /** A structured answer (JSON). */
  structured: 0.2,
} as const

/** The most keywords one suggestion offers: the main one and its alternatives. */
export const FOCUS_KEYWORD_MAX_COUNT = AI_CANDIDATE_COUNT

/** The longest single keyword, in characters; the field itself takes `SEO_META_LIMITS.focus_keyword`. */
export const FOCUS_KEYWORD_MAX_LENGTH = 60

/** The most words in one keyword: a search phrase, not a sentence. */
export const FOCUS_KEYWORD_MAX_WORDS = 6

/**
 * The longest product name suggested, in characters (a photo card's
 * name has the same ceiling, `CARD_TITLE_MAX`); the instruction asks for
 * a shorter one.
 */
export const PRODUCT_TITLE_MAX_LENGTH = 120

/** The product name's target range, told in the instruction. */
export const PRODUCT_TITLE_TARGET = { min: 30, max: 80 } as const

/** How much of a page's description the search text tasks read (adr/0074 §4). */
export const SEO_FACT_DESCRIPTION_LENGTH = 1_500

// The records with a page of their own and a facts reader (the SEO card's AI records)
const KEYWORD_ENTITIES = ["product", "category", "page"] as const

/**
 * A page's focus keyword (the SEO card's "Odak anahtar kelime"): the main
 * one first, then two or three alternatives, one per line, in the way
 * people search in Turkish. Read from the record's public facts alone;
 * nothing is written: a keyword picked fills the field, the card's own
 * Save stores it. The gate cleans list marks and case, and refuses a line
 * that is a sentence, a link or a person's data.
 */
export const FOCUS_KEYWORD_TASK: AiTask = {
  id: "focus_keyword",
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "focus_keyword",
  // One keyword; the candidates are its alternatives, each gated on its own
  maxLength: FOCUS_KEYWORD_MAX_LENGTH,
  entities: KEYWORD_ENTITIES,
  candidates: FOCUS_KEYWORD_MAX_COUNT,
  temperature: AI_TEMPERATURE.short,
  factMaxLengths: { description: SEO_FACT_DESCRIPTION_LENGTH },
}

/** How much of a product's description a name suggestion reads: the facts it may name come from it. */
export const PRODUCT_TITLE_FACT_LENGTH = 1_000

/**
 * A product's name, made clearer and easier to find: brand, model and
 * what tells it apart, from the product's own facts only. The gate
 * refuses a word the facts do not hold (an invented feature), a second
 * line, shouting, a link and a person's data. A suggestion only: the
 * general card's Save writes it.
 */
export const PRODUCT_TITLE_TASK: AiTask = {
  id: "product_title",
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "product_title",
  maxLength: PRODUCT_TITLE_MAX_LENGTH,
  entities: ["product"],
  factMaxLengths: { description: PRODUCT_TITLE_FACT_LENGTH },
  candidates: AI_CANDIDATE_COUNT,
  temperature: AI_TEMPERATURE.short,
}
