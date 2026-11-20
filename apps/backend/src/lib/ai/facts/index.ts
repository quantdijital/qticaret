import { brandOf } from "../../../workflows/messaging/brand"
import { aiValidationError } from "../errors"
import { categoryFacts } from "./category"

/** How much of a category's joined product names goes: twelve names of a hundred characters. */
const CATEGORY_PRODUCTS_LENGTH = 1_200
import { mediaFacts } from "./media"
import type { AiImageRef } from "./media"
import { PAGE_SUMMARY_LENGTH, pageFacts } from "./page"
import { productFacts } from "./product"
import { productReviewFacts, questionFacts, reviewFacts } from "./reviews"
import type { FactsContainer, RecordFacts } from "./types"
import type { AiTaskReader } from "../registry/tasks"

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
  "page",
  "media",
  "review",
  "question",
] as const
export type AiEntityType = (typeof AI_ENTITY_TYPES)[number]

/** Each type's id prefix: an id of another kind is turned away at the door. */
export const AI_ENTITY_ID_PREFIX: Readonly<Record<AiEntityType, string>> = {
  product: "prod",
  category: "pcat",
  page: "cnt",
  media: "media",
  review: "prev",
  question: "pq",
}

interface ReadRecord {
  fields: RecordFacts
  image?: AiImageRef
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
  page: fieldsOnly(pageFacts),
  media: mediaFacts,
  review: fieldsOnly(reviewFacts),
  question: fieldsOnly(questionFacts),
}

// A page's text names the shop it is on; an image is described by what it shows alone
const WITH_SHOP: ReadonlySet<AiEntityType> = new Set([
  "product",
  "category",
  "page",
  "review",
  "question",
])

/** Longest text per field where it differs from the data block's default. */
export const AI_FACT_MAX_LENGTHS: Readonly<Record<string, number>> = {
  body: PAGE_SUMMARY_LENGTH,
  // A category's product names (`CATEGORY_PRODUCT_EXAMPLES` of them), joined
  products: CATEGORY_PRODUCTS_LENGTH,
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
    maxLengths: AI_FACT_MAX_LENGTHS,
    image: read.image ?? null,
  }
}

export type { AiImageRef } from "./media"
export type { FactsContainer, RecordFacts } from "./types"
