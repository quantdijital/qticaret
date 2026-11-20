import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchImageVariantsWorkflow } from "@medusajs/medusa/core-flows"
import type { SourceProduct } from "../../lib/migration/types"

type Container = Pick<MedusaContainer, "resolve">

interface Found {
  images?: { id: string; url: string; variants?: ({ id: string } | null)[] | null }[] | null
  options?: { id: string; title: string }[] | null
  variants?:
    { id: string; options?: { value: string; option_id?: string | null }[] | null }[] | null
}

/** A product's picture as read before a save, with the variants it is tied to. */
export interface ImageWithTies {
  id: string
  url: string
  variants?: ({ id: string } | null)[] | null
}

const tiedIds = (image: ImageWithTies) =>
  (image.variants ?? []).flatMap((each) => (each ? [each.id] : []))

/**
 * The ties to put back after a save of the product's pictures: each
 * picture's variants before it, by its address, that it lacks after.
 * Pure: `keepImageTies` reads and writes.
 */
export function lostTies(
  before: readonly ImageWithTies[],
  after: readonly ImageWithTies[]
): Map<string, string[]> {
  const had = new Map<string, Set<string>>()
  for (const image of before) {
    for (const id of tiedIds(image)) {
      had.set(image.url, (had.get(image.url) ?? new Set()).add(id))
    }
  }
  const lost = new Map<string, string[]>()
  for (const image of after) {
    const wanted = had.get(image.url)
    if (!wanted) {
      continue
    }
    const now = new Set(tiedIds(image))
    const missing = [...wanted].filter((id) => !now.has(id))
    if (missing.length > 0) {
      lost.set(image.id, missing)
    }
  }
  return lost
}

/**
 * A run that adds pictures to a product moved before keeps the variant
 * ties its pictures had (the shop's own, or a run's before): Medusa's
 * save of the image list may make the kept pictures anew, without their
 * ties, so any a picture lost is put back. How many pictures were tied
 * again comes back.
 */
export async function keepImageTies(
  container: Container,
  productId: string,
  before: readonly ImageWithTies[]
): Promise<number> {
  if (!before.some((image) => tiedIds(image).length > 0)) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["images.id", "images.url", "images.variants.id"],
    filters: { id: productId },
  })
  const after = ((data[0] as Found | undefined)?.images ?? []) as ImageWithTies[]
  const lost = lostTies(before, after)
  for (const [imageId, variantIds] of lost) {
    await batchImageVariantsWorkflow(container as MedusaContainer).run({
      input: { image_id: imageId, add: variantIds },
    })
  }
  return lost.size
}

/** A variant's option values as "title=value" pairs, in a fixed order: the same key as a source's. */
const pick = (options: Readonly<Record<string, string>>) =>
  Object.entries(options)
    .map(([title, value]) => `${title.trim()}=${value.trim()}`)
    .sort()
    .join("\u0000")

/**
 * Each variant's own picture tied to it (Medusa's variant images; owner
 * 2026-11-05: choosing a colour shows its photo): the picture by the
 * address it was stored at from the source's, the variant by its option
 * values, as the catalog import wrote them. Only pictures stored in this
 * run: a product moved before stays as the shop keeps it now. A tie
 * already there stays. How many pictures were tied comes back.
 */
export async function tieVariantImages(
  container: Container,
  productId: string,
  product: SourceProduct,
  /** The source's address of each picture stored in this run, to its address here. */
  stored: ReadonlyMap<string, string>
): Promise<number> {
  const wanted = product.variants.filter((variant) => variant.image && stored.has(variant.image))
  if (wanted.length === 0) {
    return 0
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "images.id",
      "images.url",
      "images.variants.id",
      "options.id",
      "options.title",
      "variants.id",
      "variants.options.value",
      "variants.options.option_id",
    ],
    filters: { id: productId },
  })
  const found = data[0] as Found | undefined
  const titles = new Map((found?.options ?? []).map((option) => [option.id, option.title]))
  const variantOf = new Map(
    (found?.variants ?? []).map((variant) => [
      pick(
        Object.fromEntries(
          (variant.options ?? []).map((value) => [
            titles.get(value.option_id ?? "") ?? "",
            value.value,
          ])
        )
      ),
      variant.id,
    ])
  )
  const imageOf = new Map((found?.images ?? []).map((image) => [image.url, image]))
  const ties = new Map<string, Set<string>>()
  for (const variant of wanted) {
    const image = imageOf.get(stored.get(variant.image ?? "") ?? "")
    const variantId = variantOf.get(pick(variant.options))
    if (!image || !variantId) {
      continue
    }
    const tied = new Set((image.variants ?? []).flatMap((each) => (each ? [each.id] : [])))
    if (!tied.has(variantId)) {
      ties.set(image.id, (ties.get(image.id) ?? new Set()).add(variantId))
    }
  }
  for (const [imageId, variantIds] of ties) {
    await batchImageVariantsWorkflow(container as MedusaContainer).run({
      input: { image_id: imageId, add: [...variantIds] },
    })
  }
  return ties.size
}
