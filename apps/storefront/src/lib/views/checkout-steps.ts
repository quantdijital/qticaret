import type { CheckoutStep } from "@qticaret/ui"
import { cartShips } from "@/lib/cart/ships"
import { addressComplete } from "@/lib/checkout/cart"
import type { CheckoutCart } from "@/lib/checkout/cart"

export const STEP_PATHS: Record<CheckoutStep, string> = {
  address: "/odeme?adim=adres",
  shipping: "/odeme?adim=kargo",
  payment: "/odeme",
}

const STEP_OF: Record<string, CheckoutStep> = {
  adres: "address",
  kargo: "shipping",
  odeme: "payment",
}

const ALL: CheckoutStep[] = ["address", "shipping", "payment"]
const UNSHIPPED: CheckoutStep[] = ["address", "payment"]

/**
 * The steps the cart takes (adr/0076 §6): all three while anything in it
 * is shipped; a cart of digital and service lines (a gift card's too)
 * has no shipping step, its address the invoice's and the contact's.
 */
export function stepsOf(cart: Pick<CheckoutCart, "items">): CheckoutStep[] {
  return cartShips(cart.items) ? [...ALL] : [...UNSHIPPED]
}

/** The step to open: the one asked for, never past the first one still missing. */
export function stepOf(cart: CheckoutCart, asked: string | undefined): CheckoutStep {
  const steps = stepsOf(cart)
  const reachable: CheckoutStep = !addressComplete(cart)
    ? "address"
    : steps.includes("shipping") && cart.shipping_methods.length === 0
      ? "shipping"
      : "payment"
  const wanted = asked ? STEP_OF[asked] : undefined
  // A step the cart does not take (`?adim=kargo` on a cart with nothing to ship) opens the reachable one
  if (!wanted || !steps.includes(wanted)) {
    return reachable
  }
  return steps.indexOf(wanted) <= steps.indexOf(reachable) ? wanted : reachable
}

/** Where the address step goes on once saved: the shipping step, or the payment with none. */
export const afterAddressPath = (cart: Pick<CheckoutCart, "items">): string =>
  stepsOf(cart).includes("shipping") ? STEP_PATHS.shipping : STEP_PATHS.payment
