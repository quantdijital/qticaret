import type { AiPick } from "@/features/ai/components/ai-picks"
import type { ProductDetail } from "@/features/products/api/products"
import { sdk } from "@/lib/sdk"

/** A tag in the form: one of the shop's by id, or a new one (no id) created on Save. */
export interface TagValue {
  id: string | null
  value: string
}

const fold = (text: string) => text.trim().toLocaleLowerCase("tr")

/** The product's tags as the form starts with them. */
export const tagsOf = (product: ProductDetail): TagValue[] =>
  ((product as { tags?: { id: string; value: string }[] | null }).tags ?? []).map((tag) => ({
    id: tag.id,
    value: tag.value,
  }))

/** Whether a pick is in the form already: a record by id, a new tag by its name. */
export const hasTag = (tags: readonly TagValue[], pick: AiPick): boolean =>
  pick.kind === "record"
    ? tags.some((tag) => tag.id === pick.id)
    : tags.some((tag) => fold(tag.value) === fold(pick.name))

/** The form's tags with a pick added; one there already is not added twice. */
export const withTag = (tags: readonly TagValue[], pick: AiPick): TagValue[] =>
  hasTag(tags, pick)
    ? [...tags]
    : [
        ...tags,
        pick.kind === "record" ? { id: pick.id, value: pick.name } : { id: null, value: pick.name },
      ]

// The shop's tags a name search reads at most: an exact name is among the first
const LOOKUP_LIMIT = 50

/**
 * One of the shop's tags with this name, letter case aside (#251 D1): the
 * AI lists 200 of them, so a "new" one may already be there.
 */
async function existingTag(value: string): Promise<string | null> {
  const { product_tags } = await sdk.admin.productTag.list({
    q: value,
    limit: LOOKUP_LIMIT,
    fields: "id,value",
  })
  return product_tags.find((tag) => fold(tag.value) === fold(value))?.id ?? null
}

export interface TagIds {
  ids: string[]
  /** The tags this save created: taken back if the product's update fails. */
  created: string[]
}

/**
 * The tags' ids for the product's update: a new tag is first looked up by
 * name, and only created, through Medusa's own tag route, when the shop
 * has none (the person picked it; nothing was created before). A failure
 * part way takes back what this call created before passing it on.
 */
export async function tagIds(tags: readonly TagValue[]): Promise<TagIds> {
  const ids: string[] = []
  const created: string[] = []
  try {
    for (const tag of tags) {
      if (tag.id) {
        ids.push(tag.id)
        continue
      }
      const value = tag.value.trim()
      const found = await existingTag(value)
      if (found) {
        ids.push(found)
        continue
      }
      const { product_tag } = await sdk.admin.productTag.create({ value })
      created.push(product_tag.id)
      ids.push(product_tag.id)
    }
  } catch (failure) {
    await dropTags(created)
    throw failure
  }
  return { ids: [...new Set(ids)], created }
}

/** Takes back tags a failed save created; one that cannot go stays, the save's error is shown. */
export async function dropTags(ids: readonly string[]): Promise<void> {
  await Promise.allSettled(ids.map((id) => sdk.admin.productTag.delete(id)))
}
