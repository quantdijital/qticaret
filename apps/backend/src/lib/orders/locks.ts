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

/** An order's refund lock (F5 V5): its refunds, and anything that names one in a payment, one at a time. */
export const orderRefundLockKey = (orderId: string): string => `orders:refund:${orderId}`

/** An order's returns lock: its requests are opened, decided, received and refunded one at a time. */
export const returnsLockKey = (orderId: string): string => `returns:${orderId}`

/** The lock an order's gift cards are issued under (adr/0025): a cancel holds it too. */
export const giftIssueLockKey = (orderId: string): string => `gift-cards:${orderId}`

/**
 * The reference a cancel's refund of one payment is made under: the
 * payment's own, so a cancel tried again refunds each payment once, under
 * the same reference, whichever of them were refunded before (security
 * review 2026-11-17, Y1). At most 40 letters and digits.
 */
export const cancelRefundReference = (paymentId: string): string =>
  `cancel${paymentId.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40)

/**
 * A cancel's refund, by its reference: this form, or the order's own that
 * cancels before 2026-11-17 used (`cancel<order>`, `…p<n>`). No refund the
 * panel names starts so (its key is 32 hex digits).
 */
export const isCancelRefundReference = (reference: string): boolean =>
  reference.startsWith("cancel")
