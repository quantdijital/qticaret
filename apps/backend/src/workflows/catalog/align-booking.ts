import type { IProductModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Keeps a dated product's variants off stock (adr/0076 §3, K2): a variant
 * added later, or one turned to track stock or sell past it, is set back,
 * since its places are the booking module's. The variant hooks call these
 * and undo them with the values they return.
 */

interface VariantRow {
  id: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  product?: { product_extension?: { booking_mode?: string | null } | null } | null
}

/** A variant's stock fields as they were before the align. */
export interface StockFields {
  id: string
  manage_inventory: boolean
  allow_backorder: boolean
}

/** Turns stock tracking and selling past stock off on dated products' variants; the ones changed. */
export async function alignBookingVariants(
  container: MedusaContainer,
  variantIds: string[]
): Promise<StockFields[]> {
  if (variantIds.length === 0) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: ["id", "manage_inventory", "allow_backorder", "product.product_extension.booking_mode"],
    filters: { id: variantIds },
  })
  const changed = (data as VariantRow[])
    .filter(
      (variant) =>
        variant.product?.product_extension?.booking_mode === "departure" &&
        (variant.manage_inventory === true || variant.allow_backorder === true)
    )
    .map((variant) => ({
      id: variant.id,
      manage_inventory: variant.manage_inventory === true,
      allow_backorder: variant.allow_backorder === true,
    }))
  if (changed.length > 0) {
    await container
      .resolve<IProductModuleService>(Modules.PRODUCT)
      .updateProductVariants(
        { id: changed.map((variant) => variant.id) },
        { manage_inventory: false, allow_backorder: false }
      )
  }
  return changed
}

export async function restoreBookingVariants(
  container: MedusaContainer,
  previous: StockFields[]
): Promise<void> {
  const product = container.resolve<IProductModuleService>(Modules.PRODUCT)
  for (const { id, ...fields } of previous) {
    await product.updateProductVariants(id, fields)
  }
}
