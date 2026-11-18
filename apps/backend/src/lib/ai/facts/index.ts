import { brandOf } from "../../../workflows/messaging/brand"
import { aiValidationError } from "../errors"
import { categoryFacts } from "./category"
import { mediaFacts } from "./media"
import type { AiImageRef } from "./media"
import { PAGE_SUMMARY_LENGTH, pageFacts } from "./page"
import { productFacts } from "./product"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * The records a suggestion can be asked for (adr/0071 §8, §10), each read
 * on the server by its id: no text of the record is taken from the
 * client. Every reader names the fields it reads; none reads a price,
 * stock, order, customer or staff field. An image (`media`) also gives
 * the file a vision task reads.
 */
export const AI_ENTITY_TYPES = ["product", "category", "page", "media"] as const
export type AiEntityType = (typeof AI_ENTITY_TYPES)[number]

/** Each type's id prefix: an id of another kind is turned away at the door. */
export const AI_ENTITY_ID_PREFIX: Readonly<Record<AiEntityType, string>> = {
  product: "prod",
  category: "pcat",
  page: "cnt",
  media: "media",
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
}

// A page's text names the shop it is on; an image is described by what it shows alone
const WITH_SHOP: ReadonlySet<AiEntityType> = new Set(["product", "category", "page"])

/** Longest text per field where it differs from the data block's default. */
export const AI_FACT_MAX_LENGTHS: Readonly<Record<string, number>> = {
  body: PAGE_SUMMARY_LENGTH,
}

export interface EntityFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
  /** An image record's stored file; only for `media`. */
  image: AiImageRef | null
}

/** A record's fields (and the shop's name for a page), as they go to the data block. */
export async function entityFacts(
  container: FactsContainer,
  type: AiEntityType,
  id: string
): Promise<EntityFacts> {
  // Checked here too: the workflow may be run without the route's validator
  if (!Object.hasOwn(READERS, type) || !id.startsWith(`${AI_ENTITY_ID_PREFIX[type]}_`)) {
    throw aiValidationError("ai.unknown_entity")
  }
  const read = await READERS[type](container, id)
  const shop = WITH_SHOP.has(type) ? { shop: (await brandOf(container)).shopName } : {}
  return {
    fields: { ...read.fields, ...shop },
    maxLengths: AI_FACT_MAX_LENGTHS,
    image: read.image ?? null,
  }
}

export type { AiImageRef } from "./media"
export type { FactsContainer, RecordFacts } from "./types"
