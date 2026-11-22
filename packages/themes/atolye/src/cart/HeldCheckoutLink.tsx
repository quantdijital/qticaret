"use client"

import type { BookingHoldView } from "@qticaret/ui"
import { CheckoutLink } from "./CheckoutLink"
import { useHoldLeft } from "./HoldCountdown"

/**
 * "Ödemeye geç" while dated lines hold places (adr/0076 §10): the plain
 * link until the hold ends, then drawn off with the reason, as a blocked
 * cart's is. The backend refuses a payment on an expired hold itself.
 */
export function HeldCheckoutLink({
  hold,
  reason,
  ...link
}: {
  hold: BookingHoldView
  /** Said once the hold is gone. */
  reason: string
  id: string
  label: string
  className: string
  reasonClassName?: string
}) {
  const left = useHoldLeft(hold)
  return <CheckoutLink {...link} blocked={left === 0 ? { reason } : null} />
}
