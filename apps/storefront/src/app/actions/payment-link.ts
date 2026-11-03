"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { StorePaymentLinkCart } from "@qticaret/types"
import { currentCart } from "@/lib/cart/cart"
import { forgetCart, rememberCart } from "@/lib/cart/cookie"
import { isPaymentLinkCart } from "@/lib/cart/payment-link"
import { isStoreApiError } from "@/lib/store-api/errors"
import type { StoreApiError } from "@/lib/store-api/errors"
import { storePost } from "@/lib/store-api/server"
import { paymentLinkPath, paymentLinkTokenOf } from "@/lib/views/payment-link"
import type { PaymentLinkOutcome } from "@/lib/views/payment-link"

const CART_ID = /^cart_[0-9A-Za-z]{10,64}$/

/** What the backend's refusal means for the shopper; said on the link's page. */
function outcomeOf(error: StoreApiError): PaymentLinkOutcome {
  if (error.status === 429) {
    return "busy"
  }
  if (error.messageKey === "payment_link.prices_changed") {
    return "prices_changed"
  }
  if (error.messageKey === "payment_link.out_of_stock") {
    return "out_of_stock"
  }
  // Unknown, ended, paid, canceled, the links off (a bare 404), or a cart that could not be bound
  return error.status === 404 || error.messageKey === "payment_link.unavailable"
    ? "unavailable"
    : "failed"
}

/**
 * "Ödemeye geç" on `/ode/<token>` (adr/0051): the backend opens a fresh
 * cart from the link, at the link's prices with its discount, and this
 * browser keeps it as its cart; checkout goes on from there. The request
 * carries nothing but the token: the lines and prices are the link's
 * (CLAUDE.md rule 5). A refusal comes back to the link's page saying why;
 * nothing is tried again by itself.
 */
export async function openPaymentLink(form: FormData): Promise<void> {
  const token = paymentLinkTokenOf(form.get("token"))
  if (!token) {
    redirect("/")
  }
  let cartId: string
  try {
    const { cart_id } = await storePost<StorePaymentLinkCart>(
      `/store/payment-links/${token}/cart`,
      {}
    )
    cartId = cart_id
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    redirect(paymentLinkPath(token, outcomeOf(error)))
  }
  if (!CART_ID.test(cartId)) {
    redirect(paymentLinkPath(token, "failed"))
  }
  await rememberCart(cartId)
  // The header's cart is part of every page
  revalidatePath("/", "layout")
  redirect("/odeme")
}

/**
 * A payment link's cart let go (adr/0051): its lines cannot change, so a
 * shopper who wants to shop anew starts an empty cart. The link itself
 * still opens from its message while it stands. Any other cart is kept.
 */
export async function leaveLinkCart(): Promise<void> {
  try {
    const cart = await currentCart()
    if (cart && isPaymentLinkCart(cart.metadata)) {
      await forgetCart()
    }
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    redirect("/sepet?hata=cart.update_failed")
  }
  revalidatePath("/", "layout")
  redirect("/sepet")
}
