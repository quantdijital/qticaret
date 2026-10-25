import type { IInventoryService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { Link } from "@medusajs/framework/modules-sdk"
import type { ProfileLink } from "./shipping-kind"

/**
 * Keeps digital and service products off shipping as they change (F3.2):
 * a variant added later gets an inventory item that requires shipping by
 * Medusa's default, and a profile can be set again elsewhere. The hooks
 * call these and undo them with the values they return.
 */

interface VariantRow {
  id: string
  product?: { product_extension?: { kind?: string | null } | null } | null
  inventory_items?:
    | ({
        inventory_item_id: string
        inventory?: { requires_shipping?: boolean | null } | null
      } | null)[]
    | null
}

interface ProductRow {
  id: string
  shipping_profile?: { id: string } | null
  product_extension?: { kind?: string | null } | null
}

const isPhysical = (kind: string | null | undefined) => (kind ?? "physical") === "physical"

/** Sets the variants' items of non-physical products to need no shipping; returns the ones changed. */
export async function alignVariantItems(
  container: MedusaContainer,
  variantIds: string[]
): Promise<string[]> {
  if (variantIds.length === 0) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "product.product_extension.kind",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.requires_shipping",
    ],
    filters: { id: variantIds },
  })
  const ids = (data as VariantRow[])
    .filter((variant) => !isPhysical(variant.product?.product_extension?.kind))
    .flatMap((variant) =>
      (variant.inventory_items ?? []).flatMap((item) =>
        item && item.inventory?.requires_shipping !== false ? [item.inventory_item_id] : []
      )
    )
  const changed = [...new Set(ids)]
  if (changed.length > 0) {
    const inventory = container.resolve<IInventoryService>(Modules.INVENTORY)
    await inventory.updateInventoryItems(changed.map((id) => ({ id, requires_shipping: false })))
  }
  return changed
}

export async function restoreVariantItems(
  container: MedusaContainer,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length > 0) {
    const inventory = container.resolve<IInventoryService>(Modules.INVENTORY)
    await inventory.updateInventoryItems(itemIds.map((id) => ({ id, requires_shipping: true })))
  }
}

/** Takes non-physical products off a shipping profile set again; returns the links removed. */
export async function alignProductProfiles(
  container: MedusaContainer,
  productIds: string[]
): Promise<ProfileLink[]> {
  if (productIds.length === 0) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "shipping_profile.id", "product_extension.kind"],
    filters: { id: productIds },
  })
  const links: ProfileLink[] = (data as ProductRow[]).flatMap((product) =>
    !isPhysical(product.product_extension?.kind) && product.shipping_profile?.id
      ? [
          {
            [Modules.PRODUCT]: { product_id: product.id },
            [Modules.FULFILLMENT]: { shipping_profile_id: product.shipping_profile.id },
          },
        ]
      : []
  )
  if (links.length > 0) {
    await container.resolve<Link>(ContainerRegistrationKeys.LINK).dismiss(links)
  }
  return links
}

export async function restoreProductProfiles(
  container: MedusaContainer,
  links: ProfileLink[]
): Promise<void> {
  if (links.length > 0) {
    await container.resolve<Link>(ContainerRegistrationKeys.LINK).create(links)
  }
}
