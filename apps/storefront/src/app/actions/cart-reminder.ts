"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { liraRegion } from "@/lib/store-api/requests"
import { rememberCart } from "@/lib/cart/cookie"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet, storePost } from "@/lib/store-api/server"

const TOKEN = /^[\w-]{43}$/

interface ReminderCart {
  items: { variant_id: string | null; quantity: number }[]
}

/**
 * Opens the reminder e-mail's cart (F10), once the shopper confirmed it
 * here: the backend trades the token for that cart, and its lines go into
 * a fresh cart of this browser. Whoever sent the link knows the old cart's
 * id, never the new one's, so no one can follow the order placed from it.
 * Prices are the backend's (CLAUDE.md rule 5): variants and quantities only.
 */
export async function restoreCart(form: FormData): Promise<void> {
  const raw = form.get("token")
  const token = typeof raw === "string" ? raw : ""
  if (!TOKEN.test(token)) {
    redirect("/sepet?hata=cart.link_invalid")
  }
  let fresh: string
  try {
    const { cart_id } = await storePost<{ cart_id: string }>("/store/cart-reminders/redeem", {
      token,
    })
    const { cart } = await storeGet<{ cart: ReminderCart }>(
      `/store/carts/${encodeURIComponent(cart_id)}`,
      {
        fields: "items.variant_id,items.quantity",
      }
    )
    const { id: region_id } = await liraRegion()
    const made = await storePost<{ cart: { id: string } }>("/store/carts", { region_id })
    fresh = made.cart.id
    for (const line of cart.items) {
      if (line.variant_id && line.quantity > 0) {
        // A variant gone from sale since is left out, not the whole cart
        await storePost(`/store/carts/${encodeURIComponent(fresh)}/line-items`, {
          variant_id: line.variant_id,
          quantity: Math.min(line.quantity, 99),
        }).catch((error: unknown) => {
          if (!isStoreApiError(error)) {
            throw error
          }
        })
      }
    }
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    redirect(
      error.status === 429
        ? "/sepet?hata=errors.too_many_requests"
        : "/sepet?hata=cart.link_invalid"
    )
  }
  await rememberCart(fresh)
  revalidatePath("/", "layout")
  redirect("/sepet")
}
