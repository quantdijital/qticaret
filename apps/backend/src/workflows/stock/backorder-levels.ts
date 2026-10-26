import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/** The variants to look at: by id, or every variant of these products. */
export type BackorderScope = { variant_ids: string[] } | { product_ids: string[] }

interface VariantRow {
  allow_backorder: boolean
  manage_inventory: boolean
  inventory_items?:
    | ({
        inventory_item_id: string
        inventory?: { location_levels?: ({ id: string } | null)[] | null } | null
      } | null)[]
    | null
}

async function defaultLocation(container: MedusaContainer): Promise<string | null> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "store", fields: ["default_location_id"] })
  return (
    (data[0] as { default_location_id?: string | null } | undefined)?.default_location_id ?? null
  )
}

/**
 * Medusa sells past stock only from a level that exists: an item with no
 * level at all answers checkout with "not found" (adr/0020). Each such item
 * of a variant that sells past stock gets an empty level at the shop's
 * default location, which checkout's sales channel stocks from (F3.7).
 * Whether the preorder flag is on does not matter: a variant already
 * selling past stock keeps doing so (the flag only gates turning it on).
 * Returns the levels made, for the hook's compensation.
 */
export async function addBackorderLevels(
  container: MedusaContainer,
  scope: BackorderScope
): Promise<string[]> {
  const ids = "variant_ids" in scope ? scope.variant_ids : scope.product_ids
  if (ids.length === 0) {
    return []
  }
  const filters = "variant_ids" in scope ? { id: ids } : { product_id: ids }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: [
      "allow_backorder",
      "manage_inventory",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.location_levels.id",
    ],
    filters,
  })
  const bare = new Set(
    (data as VariantRow[]).flatMap((variant) =>
      variant.allow_backorder && variant.manage_inventory
        ? (variant.inventory_items ?? []).flatMap((link) =>
            link && !(link.inventory?.location_levels ?? []).some(Boolean)
              ? [link.inventory_item_id]
              : []
          )
        : []
    )
  )
  const locationId = bare.size > 0 ? await defaultLocation(container) : null
  // No default location yet: the stock page asks for one (F3.7)
  if (!locationId) {
    return []
  }
  const levels = await container.resolve(Modules.INVENTORY).createInventoryLevels(
    [...bare].map((id) => ({
      inventory_item_id: id,
      location_id: locationId,
      stocked_quantity: 0,
    }))
  )
  return levels.map((level) => level.id)
}

export async function removeBackorderLevels(
  container: MedusaContainer,
  ids: readonly string[]
): Promise<void> {
  if (ids.length > 0) {
    await container.resolve(Modules.INVENTORY).deleteInventoryLevels([...ids])
  }
}
