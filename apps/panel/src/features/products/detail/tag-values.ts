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

/**
 * The tags' ids for the product's update: a new tag is created now, through
 * Medusa's own tag route (the person picked it; nothing was created before).
 */
export async function tagIds(tags: readonly TagValue[]): Promise<string[]> {
  const ids: string[] = []
  for (const tag of tags) {
    if (tag.id) {
      ids.push(tag.id)
      continue
    }
    const { product_tag } = await sdk.admin.productTag.create({ value: tag.value.trim() })
    ids.push(product_tag.id)
  }
  return [...new Set(ids)]
}
