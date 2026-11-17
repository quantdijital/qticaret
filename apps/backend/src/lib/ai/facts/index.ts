import { brandOf } from "../../../workflows/messaging/brand"
import { aiValidationError } from "../errors"
import { categoryFacts } from "./category"
import { PAGE_SUMMARY_LENGTH, pageFacts } from "./page"
import { productFacts } from "./product"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * The records a suggestion can be asked for (adr/0071 §8, §10), each read
 * on the server by its id: no text of the record is taken from the
 * client. Every reader names the fields it reads; none reads a price,
 * stock, order, customer or staff field.
 */
export const AI_ENTITY_TYPES = ["product", "category", "page"] as const
export type AiEntityType = (typeof AI_ENTITY_TYPES)[number]

/** Each type's id prefix: an id of another kind is turned away at the door. */
export const AI_ENTITY_ID_PREFIX: Readonly<Record<AiEntityType, string>> = {
  product: "prod",
  category: "pcat",
  page: "cnt",
}

const READERS: Readonly<
  Record<AiEntityType, (container: FactsContainer, id: string) => Promise<RecordFacts>>
> = {
  product: productFacts,
  category: categoryFacts,
  page: pageFacts,
}

/** Longest text per field where it differs from the data block's default. */
export const AI_FACT_MAX_LENGTHS: Readonly<Record<string, number>> = {
  body: PAGE_SUMMARY_LENGTH,
}

export interface EntityFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
}

/** A record's fields and the shop's name, as they go to the data block. */
export async function entityFacts(
  container: FactsContainer,
  type: AiEntityType,
  id: string
): Promise<EntityFacts> {
  // Checked here too: the workflow may be run without the route's validator
  if (!Object.hasOwn(READERS, type) || !id.startsWith(`${AI_ENTITY_ID_PREFIX[type]}_`)) {
    throw aiValidationError("ai.unknown_entity")
  }
  const fields = await READERS[type](container, id)
  return {
    fields: { ...fields, shop: (await brandOf(container)).shopName },
    maxLengths: AI_FACT_MAX_LENGTHS,
  }
}

export type { FactsContainer, RecordFacts } from "./types"
