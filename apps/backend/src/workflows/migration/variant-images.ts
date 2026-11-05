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
