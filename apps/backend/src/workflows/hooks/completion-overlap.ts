/** The cart Medusa hands the `validate` hook: read under its cart lock (`completeCartFields`). */
export interface HookCart {
  id: string
  completed_at?: Date | string | null
}

/**
 * Medusa's cart lock (2.21.2 `completeCartWorkflow`: `acquireLockStep`,
 * `ttl: TWO_MINUTES`). Only a run that held it longer than this can be
 * overtaken by a second one.
 */
export const CART_LOCK_TTL_MS = 2 * 60 * 1000

const timeOf = (value: Date | string | null | undefined): number =>
  value === null || value === undefined ? Number.NaN : new Date(value).getTime()

/**
 * Whether the order our fresh read finds was placed by another run after
 * Medusa read the cart under its lock (security review N1, PR #134): two
 * runs of one cart the lock did not keep apart (its TTL ran out). Medusa
 * decided its branch (`order_cart`) before this hook, saw no order, and
 * would place a second one: the run must stop, and is tried again (the
 * next run answers with the order). Medusa writes the cart's `completed_at`
 * with its order link (one `parallelize`), so a cart it read without one
 * was read before that order.
 *
 * Bounded: only an order placed within the lock's TTL counts. A cart a
 * crash left with an order but no `completed_at` (Medusa's own read then
 * finds the order and answers with it) is tried again at most until its
 * order is that old, then answered as before; never refused, never in a
 * loop for good. An order whose time cannot be read is answered as before.
 */
export function overlapsPlacement(
  cart: HookCart,
  order: { created_at?: Date | string | null },
  now: number = Date.now()
): boolean {
  if (cart.completed_at) {
    return false
  }
  const placedAt = timeOf(order.created_at)
  return Number.isFinite(placedAt) && now - placedAt < CART_LOCK_TTL_MS
}
