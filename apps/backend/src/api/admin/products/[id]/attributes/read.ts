import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { AttributeType } from "../../../../../modules/product-attributes/validation"
import { fromColumns } from "../../../../../modules/product-attributes/values"
import type { StoredColumns } from "../../../../../modules/product-attributes/values"

interface ProductRow {
  attribute_template?: {
    id: string
    name: string
    handle: string
    definitions?: { key: string; rank: number }[]
  } | null
  attribute_values?: (
    (StoredColumns & { definition?: { key: string; type: AttributeType } | null }) | null
  )[]
}

/** A product's template (definitions in display order) and values keyed by definition. */
export async function readProductAttributes(scope: MedusaContainer, productId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "attribute_template.id",
      "attribute_template.name",
      "attribute_template.handle",
      "attribute_template.definitions.*",
      "attribute_values.*",
      "attribute_values.definition.key",
      "attribute_values.definition.type",
    ],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "product_attributes.product_unknown")
  }
  const template = product.attribute_template ?? null
  const values = Object.fromEntries(
    (product.attribute_values ?? []).flatMap((value) =>
      value?.definition ? [[value.definition.key, fromColumns(value.definition.type, value)]] : []
    )
  )
  return {
    template: template && {
      ...template,
      definitions: [...(template.definitions ?? [])].sort(
        (a, b) => a.rank - b.rank || a.key.localeCompare(b.key)
      ),
    },
    values,
  }
}
