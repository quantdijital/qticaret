import { brandOf } from "../../../workflows/messaging/brand"
import { aiValidationError } from "../errors"
import { categoryFacts } from "./category"
import { campaignFacts } from "./campaign"
import { brandFacts, collectionFacts } from "./listing"
import { mediaFacts } from "./media"
import type { AiImageRef } from "./media"
import { PAGE_SUMMARY_LENGTH, pageFacts } from "./page"
import { POST_BODY_FACT_LENGTH, postFacts } from "./post"
import { productFacts } from "./product"
import { productReviewFacts, questionFacts, reviewFacts } from "./reviews"
import type { FactsContainer, RecordFacts } from "./types"
import type { AiTaskReader } from "../registry/tasks"

/** How much of a listing's joined product names goes: twelve names of a hundred characters. */
const LISTING_PRODUCTS_LENGTH = 1_200

/**
 * The records a suggestion can be asked for (adr/0071 §8, §10), each read
 * on the server by its id: no text of the record is taken from the
 * client. Every reader names the fields it reads; none reads a price,
 * stock, order, customer or staff field. An image (`media`) also gives
 * the file a vision task reads.
 */
export const AI_ENTITY_TYPES = [
  "product",
  "category",
  "collection",
  "brand",
  "page",
  "post",
  "media",
  "review",
  "question",
  // A bulk message (adr/0050): its own words only, never its audience (facts/campaign.ts)
  "campaign",
] as const
export type AiEntityType = (typeof AI_ENTITY_TYPES)[number]

/** Each type's id prefix: an id of another kind is turned away at the door. */
export const AI_ENTITY_ID_PREFIX: Readonly<Record<AiEntityType, string>> = {
  product: "prod",
  category: "pcat",
  // Medusa's product collection, and the brands module's own (modules/brands/models/brand.ts)
  collection: "pcol",
  brand: "brand",
  page: "cnt",
  // The same records as a page (content_entry); the reader holds the kind apart
  post: "cnt",
  media: "media",
  review: "prev",
  question: "pq",
  campaign: "camp",
}

interface ReadRecord {
  fields: RecordFacts
  image?: AiImageRef
  /** Longest text per field where the kind reads more than the shared lengths (a post's body). */
  maxLengths?: Readonly<Record<string, number>>
}

const fieldsOnly =
  (read: (container: FactsContainer, id: string) => Promise<RecordFacts>) =>
  async (container: FactsContainer, id: string): Promise<ReadRecord> => ({
    fields: await read(container, id),
  })

const READERS: Readonly<
  Record<AiEntityType, (container: FactsContainer, id: string) => Promise<ReadRecord>>
> = {
  product: fieldsOnly(productFacts),
  category: fieldsOnly(categoryFacts),
  collection: fieldsOnly(collectionFacts),
  brand: fieldsOnly(brandFacts),
  page: fieldsOnly(pageFacts),
  post: async (container, id) => ({
    fields: await postFacts(container, id),
    maxLengths: { body: POST_BODY_FACT_LENGTH },
  }),
  media: mediaFacts,
  review: fieldsOnly(reviewFacts),
  question: fieldsOnly(questionFacts),
  campaign: fieldsOnly(async (container, id) => (await campaignFacts(container, id)).fields),
}

// A page's text names the shop it is on; an image is described by what it shows alone
const WITH_SHOP: ReadonlySet<AiEntityType> = new Set([
  "product",
  "category",
  "collection",
  "brand",
  "page",
  "post",
  "review",
  "question",
  "campaign",
])

/** Longest text per field where it differs from the data block's default. */
export const AI_FACT_MAX_LENGTHS: Readonly<Record<string, number>> = {
  body: PAGE_SUMMARY_LENGTH,
  // A listing's product names (`LISTING_PRODUCT_EXAMPLES` of them), joined
  products: LISTING_PRODUCTS_LENGTH,
}

export interface EntityFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
  /** An image record's stored file; only for `media`. */
  image: AiImageRef | null
}

// Records read another way than by their type: a product's reviews, the product itself kept out
const TASK_READERS: Readonly<
  Record<
    AiTaskReader,
    { type: AiEntityType; read: (c: FactsContainer, id: string) => Promise<ReadRecord> }
  >
> = {
  product_reviews: { type: "product", read: fieldsOnly(productReviewFacts) },
}

// The long texts of a record: the shop's name goes before them, so a block too long keeps it
const LONG_FIELDS: ReadonlySet<string> = new Set(["description", "body"])

/** The fields with the shop's name before the first long text (at the end when there is none). */
export function withShop(fields: RecordFacts, shop: string): RecordFacts {
  const entries = Object.entries(fields)
  const at = entries.findIndex(([name]) => LONG_FIELDS.has(name))
  entries.splice(at === -1 ? entries.length : at, 0, ["shop", shop])
  return Object.fromEntries(entries)
}

/**
 * A record's fields (and the shop's name for a page), as they go to the
 * data block; read by the task's own reader when it names one.
 */
export async function entityFacts(
  container: FactsContainer,
  type: AiEntityType,
  id: string,
  reader?: AiTaskReader
): Promise<EntityFacts> {
  // Checked here too: the workflow may be run without the route's validator
  if (!Object.hasOwn(READERS, type) || !id.startsWith(`${AI_ENTITY_ID_PREFIX[type]}_`)) {
    throw aiValidationError("ai.unknown_entity")
  }
  const byTask = reader === undefined ? null : TASK_READERS[reader]
  if (byTask && byTask.type !== type) {
    throw aiValidationError("ai.unknown_entity")
  }
  const read = await (byTask ? byTask.read : READERS[type])(container, id)
  const shop = WITH_SHOP.has(type) ? (await brandOf(container)).shopName : null
  return {
    fields: shop === null ? read.fields : withShop(read.fields, shop),
    maxLengths: { ...AI_FACT_MAX_LENGTHS, ...read.maxLengths },
    image: read.image ?? null,
  }
}

export type { AiImageRef } from "./media"
export type { FactsContainer, RecordFacts } from "./types"
