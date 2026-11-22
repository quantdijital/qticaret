import type { BookingHoldView, CheckoutBlockedView } from "@qticaret/ui"
import { CheckoutLink } from "./CheckoutLink"
import { HeldCheckoutLink } from "./HeldCheckoutLink"

/**
 * "Ödemeye geç" for the cart: blocked as the storefront says, else, while
 * dated lines hold places (adr/0076 §10), one that turns off as the hold
 * ends; without a hold the plain `CheckoutLink`, drawn exactly as before.
 */
export function PayLink({
  hold,
  expired,
  blocked,
  ...link
}: {
  hold: BookingHoldView | null | undefined
  /** Said once the hold is gone. */
  expired: string
  blocked: CheckoutBlockedView | null | undefined
  id: string
  label: string
  className: string
  reasonClassName?: string
}) {
  if (hold && !blocked) {
    return <HeldCheckoutLink {...link} hold={hold} reason={expired} />
  }
  return <CheckoutLink {...link} blocked={blocked} />
}
