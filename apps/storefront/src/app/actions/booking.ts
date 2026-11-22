"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ActionResult } from "@qticaret/ui"
import { bookingError } from "@/lib/booking/errors"
import { bookIntoCart } from "@/lib/booking/store"

const SLOT_ID = z.string().regex(/^bkslot_[0-9A-Za-z]{10,64}$/)
const VARIANT_ID = /^variant_[0-9A-Za-z]{10,64}$/
const COUNT = z.coerce.number().int().min(0).max(100)
// Price categories one request may name (the backend's own limit)
const MOST_CATEGORIES = 20
const PREFIX = "qty_"

type Counted = { ok: true; items: { variant_id: string; quantity: number }[] } | { ok: false }

/** The form's `qty_<variant>` fields: each a whole number 0–100; zero or empty is none. */
function countsOf(form: FormData): Counted {
  const items: { variant_id: string; quantity: number }[] = []
  for (const [name, value] of form.entries()) {
    if (!name.startsWith(PREFIX)) {
      continue
    }
    const variantId = name.slice(PREFIX.length)
    const count = COUNT.safeParse(typeof value === "string" && value.trim() !== "" ? value : 0)
    if (!VARIANT_ID.test(variantId) || !count.success) {
      return { ok: false }
    }
    if (count.data > 0) {
      items.push({ variant_id: variantId, quantity: count.data })
    }
  }
  return { ok: true, items }
}

/**
 * A dated product's departure into the cart (adr/0076 §5, K6): the
 * departure and how many of each price category, nothing else; the
 * backend holds the places and prices the lines. A cart is opened when
 * there is none. Sent again for the same departure, its lines become these.
 */
export async function addBookingToCart(
  _state: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slot = SLOT_ID.safeParse(form.get("slot_id"))
  if (!slot.success) {
    return { ok: false, error: "booking.choose_departure" }
  }
  const counted = countsOf(form)
  if (!counted.ok || counted.items.length > MOST_CATEGORIES) {
    return { ok: false, error: "booking.add_failed" }
  }
  if (counted.items.length === 0) {
    return { ok: false, error: "booking.choose_people" }
  }
  try {
    await bookIntoCart(slot.data, counted.items)
  } catch (error) {
    return { ok: false, error: bookingError(error) }
  }
  // The header's cart count and drawer are part of every page
  revalidatePath("/", "layout")
  return { ok: true, error: null }
}
