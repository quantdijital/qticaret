/**
 * Why a stock level moved, read from how it moved (adr/0020) when the
 * caller does not say: Medusa's level and reservation events carry no
 * reason, at most the order.
 *
 * - shelf and holds both down: an order was shipped;
 * - holds up, shelf unchanged: an order reserved stock at checkout;
 * - holds down, shelf unchanged: a reservation was let go (cancel, edit);
 * - shelf up with an order: a return was received;
 * - otherwise a person changed it (the stock page, Medusa's admin).
 */
export type DerivedReason = "order" | "return" | "cancel" | "manual"

export function reasonOf(
  deltaStocked: number,
  deltaReserved: number,
  hasOrder: boolean
): DerivedReason {
  if (deltaStocked < 0 && deltaReserved < 0) {
    return "order"
  }
  if (deltaStocked === 0) {
    if (deltaReserved > 0) {
      return "order"
    }
    if (deltaReserved < 0) {
      return "cancel"
    }
  }
  if (hasOrder) {
    return deltaStocked > 0 ? "return" : "order"
  }
  return "manual"
}
