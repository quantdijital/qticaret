import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DIMENSION_FIELDS, missingDimensions } from "../../lib/catalog"
import type { Dimensions } from "../../lib/catalog"
import { ValidationError } from "../../lib/errors"

type ProductRow = Dimensions & {
  id: string
  status: string
  variants?: (Dimensions & { id: string })[] | null
  product_extension?: { kind?: string | null } | null
}

/**
 * A published physical product must carry weight and dimensions for every
 * variant (F3.1; carriers price by them, F7.2). Drafts may lack them; digital
 * and service products (F3.2) never need them. Throws
 * `catalog.dimensions_required` naming the first missing field.
 */
export async function assertPublishable(
  container: MedusaContainer,
  productIds: string[]
): Promise<void> {
  if (productIds.length === 0) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "status",
      ...DIMENSION_FIELDS,
      "variants.id",
      ...DIMENSION_FIELDS.map((field) => `variants.${field}`),
      "product_extension.kind",
    ],
    filters: { id: productIds },
  })
  for (const product of data as ProductRow[]) {
    const kind = product.product_extension?.kind ?? "physical"
    if (product.status !== "published" || kind !== "physical") {
      continue
    }
    const variants = product.variants?.length ? product.variants : [{}]
    for (const variant of variants) {
      const [missing] = missingDimensions(product, variant)
      if (missing) {
        throw new ValidationError("catalog.dimensions_required", { field: missing })
      }
    }
  }
}

/** The products a batch of variants belongs to, each once. */
export const productIdsOf = (variants: { product_id?: string | null }[]): string[] => [
  ...new Set(variants.flatMap((variant) => (variant.product_id ? [variant.product_id] : []))),
]
