import type { MedusaContainer } from "@medusajs/framework/types"
import { promotionShells } from "../../lib/wholesale"
import { linkIdOfCart } from "../payment-links/cart-guard"
import { wholesaleShopper } from "./shopper"

type Container = Pick<MedusaContainer, "resolve">

interface Adjusted {
  id: string
  adjustments?: unknown[] | null
}

/** The cart as Medusa's promotion workflow hands it to `setPromotionContext` (2.21.2). */
export interface PromotionCart {
  customer_id?: string | null
  /**
   * Medusa's refresh reads the cart with `customer.*` (2.21.2
   * `cartFieldsForRefreshSteps`), not `customer_id` by name: either names
   * the customer (slice 4 review O2 b).
   */
  customer?: { id?: string | null } | null
  metadata?: Record<string, unknown> | null
  items?: (Adjusted | null)[] | null
  shipping_methods?: (Adjusted | null)[] | null
}

/**
 * ADR-0068 §6, Ek 2026-11-16: automatic campaigns are not a wholesaler's,
 * nor codes. For an active wholesaler's cart (the shop's flag on), Medusa's
 * promotion rules are given its lines and shipping as shells
 * (`promotionShells`): every adjustment the cart had comes off and none is
 * made, whichever promotion, automatic or coded, whatever its rules. Every
 * other cart (a guest's, a retail customer's, a payment link's whose code
 * staff set, adr/0051) is left as Medusa reads it: nothing returned.
 */
export async function wholesalePromotionContext(
  container: Container,
  cart: PromotionCart | null | undefined
): Promise<ReturnType<typeof promotionShells> | undefined> {
  const customerId = cart?.customer_id ?? cart?.customer?.id
  if (!cart || !customerId || linkIdOfCart(cart.metadata) !== null) {
    return undefined
  }
  if (!(await wholesaleShopper(container, customerId)).active) {
    return undefined
  }
  return promotionShells(cart)
}
