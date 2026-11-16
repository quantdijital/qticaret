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

/**
 * What a placed order means for an orphan's refund (finding 2026-11-16):
 * - `held`: the order holds this very payment: never given back;
 * - `beside`: the cart "could not be completed", yet is an order paid with
 *   another payment: likely paid twice; left to the shop, not given back
 *   on its own (review N2);
 * - `unread`: the cart is marked completed, its order cannot be read:
 *   nothing given back now, tried again.
 * Null: no order stands in the way (none, or an order paid otherwise for
 * a payment replaced or for the wrong amount: money taken for nothing).
 */
export type OrderCheck =
  | { kind: "held"; order_id: string }
  | { kind: "beside"; order_id: string }
  | { kind: "unread" }
  | null

/** Our payment session behind an orphan's reference, where the reference names it (PayTR). */
export const sessionOfRecovery = (recovery: Pick<RecoveryRow, "provider" | "reference">) =>
  recovery.provider === "paytr" ? paytrSessionIdOf(recovery.reference) : null

/** The orphan against its cart's placed order (see `OrderCheck`). */
export function orderCheckOf(recovery: RecoveryRow, placed: PlacedOrder | null): OrderCheck {
  if (!placed) {
    return null
  }
  if (!placed.order_id) {
    return { kind: "unread" }
  }
  const sessionId = sessionOfRecovery(recovery)
  if (
    placed.references.includes(recovery.reference) ||
    (sessionId !== null && placed.session_ids.includes(sessionId))
  ) {
    return { kind: "held", order_id: placed.order_id }
  }
  return recovery.reason === "completion_failed"
    ? { kind: "beside", order_id: placed.order_id }
    : null
}

/**
 * The placed order in the way of an orphan's refund: by its cart, then by
 * its payment session (PayTR's reference names it; a session gone with its
 * cart unknown is found this way). Throws when it cannot read: the caller
 * gives nothing back then (fail closed).
 */
export async function orderOfRecovery(
  container: Container,
  recovery: RecoveryRow
): Promise<OrderCheck> {
  if (recovery.cart_id) {
    const check = orderCheckOf(recovery, await placedOrderOfCart(container, recovery.cart_id))
    if (check) {
      return check
    }
  }
  const sessionId = sessionOfRecovery(recovery)
  const orderId = sessionId ? await orderOfSession(container, sessionId) : null
  return orderId ? { kind: "held", order_id: orderId } : null
}
