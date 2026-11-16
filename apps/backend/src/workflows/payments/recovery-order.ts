import type { MedusaContainer } from "@medusajs/framework/types"
import type { RecoveryInput } from "../../modules/payment-recovery/service"
import { orderOfSession, paytrSessionIdOf, placedOrderOfCart } from "./placed-order"
import type { PlacedOrder } from "./placed-order"

type Container = Pick<MedusaContainer, "resolve">

export interface RecoveryRow {
  provider: string
  reference: string
  reason: RecoveryInput["reason"]
  cart_id: string | null
}

/** Our payment session behind an orphan's reference, where the reference names it (PayTR). */
export const sessionOfRecovery = (recovery: Pick<RecoveryRow, "provider" | "reference">) =>
  recovery.provider === "paytr" ? paytrSessionIdOf(recovery.reference) : null

/**
 * Whether the cart's placed order stops the orphan's refund (finding
 * 2026-11-16). A cart that "could not be completed" yet is an order was
 * misjudged: never given back, whichever payment the order holds (one it
 * does not hold is the shop's to look at, review N2). Any other orphan of
 * the cart is stopped only when the order holds its payment: a payment
 * replaced or for the wrong amount beside an order paid otherwise is
 * still money taken for nothing, and goes back.
 */
export function orderStopsRefund(recovery: RecoveryRow, placed: PlacedOrder): boolean {
  if (recovery.reason === "completion_failed") {
    return true
  }
  const sessionId = sessionOfRecovery(recovery)
  return (
    placed.references.includes(recovery.reference) ||
    (sessionId !== null && placed.session_ids.includes(sessionId))
  )
}

/**
 * The placed order an orphan's payment belongs to, before it is given
 * back: by its cart, then by its payment session (PayTR's reference names
 * it; a session gone with its cart unknown is found this way). `found`
 * with a null order: the cart is marked completed, its order unread; still
 * never refunded. Throws when it cannot read: the caller refunds nothing
 * then (fail closed).
 */
export async function orderOfRecovery(
  container: Container,
  recovery: RecoveryRow
): Promise<{ order_id: string | null } | null> {
  if (recovery.cart_id) {
    const placed = await placedOrderOfCart(container, recovery.cart_id)
    if (placed && orderStopsRefund(recovery, placed)) {
      return { order_id: placed.order_id }
    }
  }
  const sessionId = sessionOfRecovery(recovery)
  const orderId = sessionId ? await orderOfSession(container, sessionId) : null
  return orderId ? { order_id: orderId } : null
}
