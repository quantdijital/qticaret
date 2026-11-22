import type { CheckoutStep } from "@qticaret/ui"
import { cartShips } from "@/lib/cart/ships"
import { addressComplete } from "@/lib/checkout/cart"
import type { CheckoutCart } from "@/lib/checkout/cart"

export const STEP_PATHS: Record<CheckoutStep, string> = {
  address: "/odeme?adim=adres",
  shipping: "/odeme?adim=kargo",
  travelers: "/odeme?adim=katilimcilar",
  payment: "/odeme",
}

const STEP_OF: Record<string, CheckoutStep> = {
  adres: "address",
  kargo: "shipping",
  katilimcilar: "travelers",
  odeme: "payment",
}

/**
 * The cart's travelers as the steps need them (adr/0076 Ek D6b): null
 * when no departure in it asks for any, else whether they are all in.
 */
export type TravelersAsked = { complete: boolean } | null

/**
 * The steps the cart takes (adr/0076 §6): all three while anything in it
 * is shipped; a cart of digital and service lines (a gift card's too)
 * has no shipping step, its address the invoice's and the contact's. A
 * departure that asks for its travelers adds their step before the
 * payment (Ek D6b).
 */
export function stepsOf(
  cart: Pick<CheckoutCart, "items">,
  travelers: TravelersAsked = null
): CheckoutStep[] {
  return [
    "address",
    ...(cartShips(cart.items) ? (["shipping"] as const) : []),
    ...(travelers ? (["travelers"] as const) : []),
    "payment",
  ]
}

/** The first step still missing: the address, the shipping, the travelers, else the payment. */
function reachableOf(
  cart: CheckoutCart,
  steps: readonly CheckoutStep[],
  travelers: TravelersAsked
): CheckoutStep {
  if (!addressComplete(cart)) {
    return "address"
  }
  if (steps.includes("shipping") && cart.shipping_methods.length === 0) {
    return "shipping"
  }
  return travelers && !travelers.complete ? "travelers" : "payment"
}

/** The step to open: the one asked for, never past the first one still missing. */
export function stepOf(
  cart: CheckoutCart,
  asked: string | undefined,
  travelers: TravelersAsked = null
): CheckoutStep {
  const steps = stepsOf(cart, travelers)
  const reachable = reachableOf(cart, steps, travelers)
  const wanted = asked ? STEP_OF[asked] : undefined
  // A step the cart does not take (`?adim=kargo` on a cart with nothing to ship) opens the reachable one
  if (!wanted || !steps.includes(wanted)) {
    return reachable
  }
  return steps.indexOf(wanted) <= steps.indexOf(reachable) ? wanted : reachable
}

/**
 * Where the address step goes on once saved: the shipping step, or the
 * payment with none (which opens the travelers step while they are missing).
 */
export const afterAddressPath = (cart: Pick<CheckoutCart, "items">): string =>
  stepsOf(cart).includes("shipping") ? STEP_PATHS.shipping : STEP_PATHS.payment
