import { MIN_LISTING_WORDS } from "../../seo/advisor"
import { AI_TEMPERATURE } from "./catalog-tasks"
import type { AiTask } from "./tasks"

/**
 * A listing page's own text (adr/0074 §5 madde 1, adr/0075): a category's,
 * a collection's and a brand's description, drawn under the products.
 * Plain text paragraphs, never HTML (adr/0071 §9): the listing description
 * document takes them as plain paragraphs, as a product's description does.
 * The gate is the advisor's listing word count (`MIN_LISTING_WORDS`,
 * C/B/K-CONT-01) and what no suggestion may carry. Two ready-made lengths,
 * nothing typed. One task per kind, so a shop's guidance and its own craft
 * can differ per page kind; the craft is shared (lib/ai/crafts/listing.ts).
 */

/** The listing description task of each kind of listing page. */
export const LISTING_DESCRIPTION_TASK_IDS = {
  category: "category_description",
  collection: "collection_description",
  brand: "brand_description",
} as const
export type ListingKind = keyof typeof LISTING_DESCRIPTION_TASK_IDS

/** A listing's word targets: never under the advisor's floor, the gate's too. */
export const LISTING_WORDS = {
  min: MIN_LISTING_WORDS,
  short: Math.round(MIN_LISTING_WORDS * 1.5),
  usual: MIN_LISTING_WORDS * 2,
  detailed: MIN_LISTING_WORDS * 3,
} as const

/** How much of the listing's description now the task sends. */
export const LISTING_DESCRIPTION_FACT_LENGTH = 2_000

/** The longest listing description suggestion, in characters (the "detailed" option with room). */
export const LISTING_DESCRIPTION_MAX_LENGTH = 4_000

const listingTask = (kind: ListingKind): AiTask => ({
  id: LISTING_DESCRIPTION_TASK_IDS[kind],
  capability: "text",
  mode: "sync",
  options: ["short", "detailed"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "listing_description",
  maxLength: LISTING_DESCRIPTION_MAX_LENGTH,
  entities: [kind],
  factMaxLengths: { description: LISTING_DESCRIPTION_FACT_LENGTH },
  temperature: AI_TEMPERATURE.long,
})

export const CATEGORY_DESCRIPTION_TASK = listingTask("category")
export const COLLECTION_DESCRIPTION_TASK = listingTask("collection")
export const BRAND_DESCRIPTION_TASK = listingTask("brand")
