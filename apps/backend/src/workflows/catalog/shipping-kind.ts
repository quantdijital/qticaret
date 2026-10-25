import { Modules } from "@medusajs/framework/utils"

/**
 * What a product's kind means for shipping (F3.2), as Medusa decides a
 * cart line needs it: a shipping profile on the product, or an inventory
 * item that "requires shipping". A digital or service product has
 * neither; a physical one gets the shop's default profile back and its
 * items require shipping again. Pure, so tested on its own.
 */

export type ProductKind = "physical" | "digital" | "service"

export interface ShippingRow {
  id: string
  shipping_profile?: { id: string } | null
  variants?:
    | ({
        inventory_items?:
          | ({
              inventory_item_id: string
              inventory?: { requires_shipping?: boolean | null } | null
            } | null)[]
          | null
      } | null)[]
    | null
}

export type ProfileLink = Record<string, Record<string, string>>

export interface ShippingChanges {
  dismiss: ProfileLink[]
  link: ProfileLink[]
  inventory: { id: string; requires_shipping: boolean }[]
}

export const NO_SHIPPING_CHANGES: ShippingChanges = { dismiss: [], link: [], inventory: [] }

const profileLink = (productId: string, profileId: string): ProfileLink => ({
  [Modules.PRODUCT]: { product_id: productId },
  [Modules.FULFILLMENT]: { shipping_profile_id: profileId },
})

/** The links and items to change so the product ships as its kind says; nothing when it already does. */
export function shippingChanges(
  product: ShippingRow,
  kind: ProductKind,
  defaultProfileId: string | null
): ShippingChanges {
  const ships = kind === "physical"
  const items = new Map<string, boolean>()
  for (const variant of product.variants ?? []) {
    for (const item of variant?.inventory_items ?? []) {
      if (item) {
        // Missing reads as Medusa's default: requires shipping
        items.set(item.inventory_item_id, item.inventory?.requires_shipping ?? true)
      }
    }
  }
  const profile = product.shipping_profile?.id ?? null
  return {
    dismiss: !ships && profile ? [profileLink(product.id, profile)] : [],
    link: ships && !profile && defaultProfileId ? [profileLink(product.id, defaultProfileId)] : [],
    inventory: [...items.entries()]
      .filter(([, requires]) => requires !== ships)
      .map(([id]) => ({ id, requires_shipping: ships })),
  }
}

/** The fields shippingChanges reads, from a product query. */
export const SHIPPING_FIELDS = [
  "shipping_profile.id",
  "variants.inventory_items.inventory_item_id",
  "variants.inventory_items.inventory.requires_shipping",
]
