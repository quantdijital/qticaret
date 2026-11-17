import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils"

type Container = Pick<MedusaContainer, "resolve">

/** A cart line asked for: an existing line by its id, or a variant to add. */
export interface LineAsk {
  cartId: string
  lineId: string | null
  variantId: string | null
}

interface CartRow {
  sales_channel_id?: string | null
  items?: ({ id?: string | null; variant_id?: string | null } | null)[] | null
}

interface VariantRow {
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
}

/**
 * How many units of the line's variant are for sale over the cart's sales
 * channel locations, as Medusa counts them (`getVariantAvailability`:
 * stocked − reserved, the count its add-to-cart check uses). Null when the
 * variant is not tracked or sells past the shelf, or the cart, line or
 * channel is not found: then there is no count to tell.
 */
export async function lineAvailableUnits(
  container: Container,
  ask: LineAsk
): Promise<number | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["sales_channel_id", "items.id", "items.variant_id"],
    filters: { id: ask.cartId },
  })
  const cart = carts[0] as CartRow | undefined
  const salesChannelId = cart?.sales_channel_id
  const variantId = ask.lineId
    ? (cart?.items ?? []).find((item) => item?.id === ask.lineId)?.variant_id
    : ask.variantId
  if (!salesChannelId || !variantId) {
    return null
  }
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["manage_inventory", "allow_backorder"],
    filters: { id: variantId },
  })
  const variant = variants[0] as VariantRow | undefined
  if (!variant?.manage_inventory || variant.allow_backorder) {
    return null
  }
  const availability = await getVariantAvailability(query, {
    variant_ids: [variantId],
    sales_channel_id: salesChannelId,
  })
  const units = Number(availability[variantId]?.availability)
  return Number.isSafeInteger(units) && units >= 0 ? units : null
}
