import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { optionKey } from "../plan-variants"

interface VariantRow {
  id: string
  options?: { value: string; option_id: string }[] | null
}

/**
 * A product's variants with the key of their option values (F3.9): how an
 * import finds a variant it made, which had no id when it was planned.
 * `fields` are the variants' other fields the caller reads.
 */
export async function keyedVariants<T extends VariantRow>(
  container: MedusaContainer,
  productId: string,
  fields: readonly string[] = []
): Promise<(T & { key: string })[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "options.id",
      "options.title",
      "variants.id",
      "variants.options.value",
      "variants.options.option_id",
      ...fields,
    ],
    filters: { id: productId },
  })
  const product = data[0] as
    { options?: { id: string; title: string }[] | null; variants?: T[] | null } | undefined
  const titleOf = new Map((product?.options ?? []).map((option) => [option.id, option.title]))
  return (product?.variants ?? []).map((variant) => ({
    ...variant,
    key: optionKey(
      Object.fromEntries(
        (variant.options ?? []).map((value) => [titleOf.get(value.option_id) ?? "", value.value])
      )
    ),
  }))
}
