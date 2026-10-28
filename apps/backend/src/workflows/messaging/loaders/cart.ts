import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PaymentFailedVars } from "../../../lib/messaging/templates"
import type { MedusaAmount } from "../../../lib/money"
import { brandOf } from "../brand"
import { lira } from "./order"
import { GREETING, firstText } from "./types"
import type { Loaded } from "./types"

/** The storefront's cart page (F18 builds it). */
export const CART_PATH = "/sepet"

interface CartRow {
  email: string | null
  customer_id: string | null
  completed_at: string | Date | null
  total: MedusaAmount
  shipping_address: { first_name?: string | null } | null
}

/**
 * A cart whose payment was refused, while it is still unpaid; null once
 * the shopper paid it after all (the message would only confuse) or when
 * it has no e-mail yet.
 */
export async function loadPaymentFailed(
  container: Pick<MedusaContainer, "resolve">,
  cartId: string
): Promise<Loaded<PaymentFailedVars> | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["email", "customer_id", "completed_at", "total", "shipping_address.first_name"],
    filters: { id: cartId },
  })
  const cart = data[0] as CartRow | undefined
  if (!cart?.email || cart.completed_at) {
    return null
  }
  const { storefrontUrl } = await brandOf(container)
  return {
    vars: {
      customerName: firstText(cart.shipping_address?.first_name) ?? GREETING,
      total: lira(cart.total),
      cartUrl: storefrontUrl ? `${storefrontUrl}${CART_PATH}` : null,
    },
    recipients: { email: cart.email },
    receiverId: cart.customer_id,
    resourceType: "cart",
  }
}
