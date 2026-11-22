"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { TravelersResult } from "@qticaret/ui"
import { cartTravelers, saveCartTravelers } from "@/lib/booking/travelers"
import { linkCartRefusal } from "@/lib/cart/payment-link"
import { checkoutCart } from "@/lib/checkout/cart"
import { checkoutError } from "@/lib/checkout/place-order"
import { isStoreApiError } from "@/lib/store-api/errors"
import { parseTravelers } from "@/lib/checkout/traveler-form"

/**
 * The checkout's travelers step (adr/0076 Ek D6b): each traveler's name
 * and, as their departure asks, birth date, ID or passport number and
 * nationality, all at once. Checked here first so a mistake points at its
 * field (the backend's refusal does not name one); the backend checks them
 * again against what each departure asks. Nothing priced.
 */
export async function saveTravelers(
  _state: TravelersResult,
  form: FormData
): Promise<TravelersResult> {
  const cart = await checkoutCart()
  if (!cart) {
    redirect("/sepet")
  }
  // Which fields each departure asks: a select left on its prompt sends nothing at all
  const asked = await cartTravelers(cart.id)
  const levels = asked ? new Map(asked.needs.map((need) => [need.slot_id, need.level])) : null
  const parsed = parseTravelers(form, levels)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, field: parsed.field }
  }
  try {
    await saveCartTravelers(cart.id, parsed.travelers)
  } catch (error) {
    return { ok: false, error: travelersError(error), field: null }
  }
  revalidatePath("/odeme")
  redirect("/odeme")
}

/** A refused write in words' key: a payment link's cart, too many asks, the backend's own refusal. */
function travelersError(error: unknown): string {
  const link = linkCartRefusal(error)
  if (link) {
    return link
  }
  // Not the payment provider's words: the travelers could not be saved
  if (isStoreApiError(error) && error.status >= 500) {
    return "checkout.travelers_failed"
  }
  return checkoutError(error, "checkout.travelers_failed")
}
