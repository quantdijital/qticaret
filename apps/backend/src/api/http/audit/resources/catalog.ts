import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

interface ProductRow {
  variants?: ({ id: string; variant_extension?: { mpn: string | null } | null } | null)[] | null
  product_extension?: {
    condition: string
    primary_category_id: string | null
    successor_product_id: string | null
  } | null
}

/**
 * A product's catalog fields (F3.1, adr/0011), as stored: the IDs it holds
 * even when the category or successor they name is gone, and one
 * `mpn.<variant id>` per variant. An unknown product reads as nothing.
 */
async function catalogSnapshot(scope: Resolver, productId: string): Promise<Snapshot> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: "product",
    fields: ["product_extension.*", "variants.id", "variants.variant_extension.mpn"],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    return {}
  }
  const extension = product.product_extension ?? null
  return {
    condition: extension?.condition ?? "new",
    primary_category_id: extension?.primary_category_id ?? null,
    successor_product_id: extension?.successor_product_id ?? null,
    ...Object.fromEntries(
      (product.variants ?? []).flatMap((variant) =>
        variant ? [[`mpn.${variant.id}`, variant.variant_extension?.mpn ?? null]] : []
      )
    ),
  }
}

export const CATALOG_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/products/:id/catalog",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/catalog$`, "i"),
    resourceType: "product",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => catalogSnapshot(scope, params["id"] ?? ""),
  },
]
