import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { CartReminderVars } from "../../../lib/messaging/templates"
import type { MedusaAmount } from "../../../lib/money"
import { CART_RETURN_DAYS } from "../../../modules/cart-reminders/service"
import { brandOf } from "../brand"
import { lira } from "./order"
import { GREETING, personName } from "./types"
import type { Loaded } from "./types"

/**
 * The storefront's page that opens a reminded cart (F18 builds it). It
 * redeems the token on the shopper's press, not on load: a mail scanner
 * opening the link would use it up.
 */
export const CART_RETURN_PATH = "/sepet/geri-don"

interface CartRow {
  email: string | null
  customer_id: string | null
  completed_at: string | Date | null
  items:
    | ({
        product_title?: string | null
        title?: string | null
        variant_title?: string | null
        quantity: MedusaAmount
        total: MedusaAmount
      } | null)[]
    | null
  shipping_address: { first_name?: string | null } | null
}

const filled = (value: string | null | undefined): string => (value ?? "").trim()

/**
 * A cart left behind (F10.7): its lines and the link that opens it, with
 * the token only the run knew. Null once the cart is an order or empty,
 * or while the shop has no storefront domain.
 */
export async function loadCartReminder(
  container: Pick<MedusaContainer, "resolve">,
  cartId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<CartReminderVars> | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    // Medusa works out the lines' totals only when the cart's own is asked for too
    fields: [
      "email",
      "customer_id",
      "completed_at",
      "total",
      "items.product_title",
      "items.title",
      "items.variant_title",
      "items.quantity",
      "items.total",
      "shipping_address.first_name",
    ],
    filters: { id: cartId },
  })
  const cart = data[0] as CartRow | undefined
  const items = (cart?.items ?? []).filter((item) => item !== null)
  const { storefrontUrl } = await brandOf(container)
  const token = extra["token"]
  if (!cart?.email || cart.completed_at || items.length === 0 || !storefrontUrl || !token) {
    return null
  }
  return {
    vars: {
      customerName: personName(cart.shipping_address?.first_name) ?? GREETING,
      items: items.map((item) => ({
        title: filled(item.product_title) || filled(item.title),
        detail: filled(item.variant_title) || null,
        quantity: Number(item.quantity),
        total: lira(item.total),
      })),
      cartUrl: `${storefrontUrl}${CART_RETURN_PATH}?${new URLSearchParams({ token }).toString()}`,
      days: CART_RETURN_DAYS,
    },
    recipients: { email: cart.email },
    receiverId: cart.customer_id,
    resourceType: "cart",
  }
}
