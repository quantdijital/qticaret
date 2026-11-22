import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { bookingMarkOf } from "../../../lib/booking/cart-lines"
import { bookingService } from "./target"

type Container = Pick<MedusaContainer, "resolve">

interface CartRow {
  sales_channel_id?: string | null
  items?:
    | ({
        id: string
        variant_id?: string | null
        quantity: unknown
        unit_price: unknown
        requires_shipping?: boolean | null
        metadata?: unknown
      } | null)[]
    | null
  shipping_methods?: ({ id: string } | null)[] | null
}

/**
 * The cart's dated side (after a booking change, or read for the
 * storefront's countdown): its live hold's end and its dated lines, each
 * `held` while that hold keeps its places. `shipping_method_stale`:
 * nothing in the cart ships any more but a shipping method is left from
 * before (adr/0076 Ek D3); the server takes it off on the cart's change and
 * at the payment's start (Ek D5), so this is true only for a moment.
 */
export async function bookingCartView(
  container: Container,
  cartId: string,
  salesChannelIds: string[]
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
      "sales_channel_id",
      "items.id",
      "items.variant_id",
      "items.quantity",
      "items.unit_price",
      "items.requires_shipping",
      "items.metadata",
      "shipping_methods.id",
    ],
    filters: { id: cartId },
  })
  const cart = (data as CartRow[])[0]
  // Only a cart of this storefront's sales channel; none, not found (security review D-2/D-3)
  if (!cart || !salesChannelIds.includes(cart.sales_channel_id ?? "")) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
  }
  const items = (cart.items ?? []).flatMap((item) => (item ? [item] : []))
  const hold = await bookingService(container).cartHold(cartId)
  return {
    hold: hold?.live ? { expires_at: hold.expires_at.toISOString() } : null,
    lines: items.flatMap((item) => {
      const mark = bookingMarkOf(item.metadata)
      return mark
        ? [
            {
              id: item.id,
              variant_id: item.variant_id ?? null,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              slot_id: mark.slot_id,
              starts_at: mark.starts_at,
              // The live hold still keeps this line's places (a hold opened anew leaves older lines out)
              held: hold?.live === true && hold.hold_id === mark.hold_id,
            },
          ]
        : []
    }),
    shipping_method_stale:
      (cart.shipping_methods ?? []).some(Boolean) &&
      !items.some((item) => item.requires_shipping !== false),
  }
}
