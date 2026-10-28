import { bankTransferLockKey } from "../payments/bank-transfer"

/** "Kargoya ver"'s lock for an order: one parcel packed at a time (adr/0022). */
export const shipLockKey = (orderId: string): string => `orders:ship:${orderId}`

/**
 * What a cancel holds (security review 2026-10-28): the ship lock, so a
 * parcel is never packed while the money goes back, and the bank
 * transfer's, so money is not confirmed meanwhile (adr/0029). Nothing
 * that holds one of them waits for the other, so no two wait on each other.
 */
export const cancelLockKeys = (orderId: string): string[] => [
  bankTransferLockKey(orderId),
  shipLockKey(orderId),
]

/** An order's returns lock: its requests are opened, decided, received and refunded one at a time. */
export const returnsLockKey = (orderId: string): string => `returns:${orderId}`

/**
 * The reference a cancel's refund is made under: tried again, refunded
 * once (F5 V5). A cancel refunding several payments (an edit's collected
 * difference) numbers the later ones.
 */
export const cancelRefundReference = (orderId: string, part = 0): string => {
  const base = `cancel${orderId.replace(/[^A-Za-z0-9]/g, "")}`
  return part === 0 ? base.slice(0, 40) : `${base.slice(0, 37)}p${String(part)}`
}
