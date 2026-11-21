import { SUMMARY_TEXT_MAX } from "../../catalog/summary"
import { AI_CANDIDATE_COUNT, AI_TEMPERATURE, PRODUCT_TITLE_FACT_LENGTH } from "./catalog-tasks"
import type { AiTask } from "./tasks"

/**
 * The product page's second widening (adr/0074 §5 madde 2): its short
 * description, and the tags and categories it is listed under, picked
 * from the shop's own lists. Kept apart from `tasks.ts` for its length;
 * registered there, in its order.
 */

/**
 * The longest short description suggested: the field's own cap
 * (`SUMMARY_TEXT_MAX`, the panel's editor and the server's check), never
 * typed twice; the instruction asks for one or two sentences.
 */
export const SHORT_DESCRIPTION_MAX_LENGTH = SUMMARY_TEXT_MAX

/** The most sentences one short description holds (the gate's `sentences`). */
export const SHORT_DESCRIPTION_MAX_SENTENCES = 2

/**
 * A product's short description (the product page's "Kısa açıklama", the
 * `summary_doc` shown under its name above the price; adr/0055 Ek
 * 2026-11-06): one or two sentences from its own facts, offered as
 * `AI_CANDIDATE_COUNT` candidates, each gated on its own. Prose for a
 * shopper: the shop's guidance and the owner's craft apply. Nothing is
 * written: "Kullan" puts it in the editor as a paragraph, the card's Save
 * stores it.
 */
export const SHORT_DESCRIPTION_TASK: AiTask = {
  id: "short_description",
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "short_description",
  maxLength: SHORT_DESCRIPTION_MAX_LENGTH,
  entities: ["product"],
  factMaxLengths: { description: PRODUCT_TITLE_FACT_LENGTH },
  candidates: AI_CANDIDATE_COUNT,
  temperature: AI_TEMPERATURE.short,
}

/** The shop's tags named in one prompt at most, by their names under short codes. */
export const MAX_TAG_CHOICES = 200

/** Existing tags one suggestion offers at most. */
export const MAX_SUGGESTED_TAGS = 8

/** New tags one suggestion offers at most; none is created until a person picks it. */
export const MAX_NEW_TAGS = 3

/** The longest new tag, in characters, and its most words: a label, not a sentence. */
export const NEW_TAG_MAX_LENGTH = 40
export const NEW_TAG_MAX_WORDS = 4

/** The longest answer read for a pick task, in characters: its JSON, all fields together. */
export const PICKS_MAX_LENGTH = 2_000

/**
 * Tags for a product: up to `MAX_SUGGESTED_TAGS` of the shop's own tags
 * (its first `MAX_TAG_CHOICES` by name, those it has already left out),
 * named back by their codes, and up to `MAX_NEW_TAGS` new ones apart. One
 * JSON object read against a closed schema; a code not in the list
 * refuses the answer (lib/ai/product-picks.ts). Structured data: no
 * guidance or craft. Nothing is written or created: the panel adds what
 * a person picks, and creates a new tag only then.
 */
export const PRODUCT_TAGS_TASK: AiTask = {
  id: "product_tags",
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "product_tags",
  maxLength: PICKS_MAX_LENGTH,
  entities: ["product"],
  factMaxLengths: { description: PRODUCT_TITLE_FACT_LENGTH },
  json: true,
  temperature: AI_TEMPERATURE.structured,
}

/** Categories one suggestion offers at most. */
export const MAX_SUGGESTED_CATEGORIES = 3

/**
 * Categories for a product: up to `MAX_SUGGESTED_CATEGORIES` of the shop's
 * shown categories (none internal or closed, nor under such a parent;
 * those it is already in left out), by their codes, no reasons. A code
 * not in the list refuses the answer; a new category is never made up.
 * Structured data: no guidance or craft. Nothing is written: a chip the
 * person clicks adds it to the form, the form's Save stores it.
 */
export const PRODUCT_CATEGORY_TASK: AiTask = {
  id: "product_category",
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "product_category",
  maxLength: PICKS_MAX_LENGTH,
  entities: ["product"],
  factMaxLengths: { description: PRODUCT_TITLE_FACT_LENGTH },
  json: true,
  temperature: AI_TEMPERATURE.structured,
}
