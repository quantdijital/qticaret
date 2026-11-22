import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bookingMarkOf } from "../../../lib/booking/cart-lines"
import { bookingService } from "./target"

type Container = Pick<MedusaContainer, "resolve">

interface CartRow {
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
 * The cart's dated side after a booking change: its hold's end (for the
 * storefront's countdown) and its dated lines. `shipping_method_stale`:
 * nothing in the cart ships any more but a shipping method is left from
 * before (adr/0076 Ek D3); the storefront asks again or drops it.
 */
export async function bookingCartView(container: Container, cartId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
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
  const cart = (data[0] ?? {}) as CartRow
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
            },
          ]
        : []
    }),
    shipping_method_stale:
      (cart.shipping_methods ?? []).some(Boolean) &&
      !items.some((item) => item.requires_shipping !== false),
  }
}
