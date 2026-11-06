"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import type { ActionResult } from "@qticaret/ui"
import {
  addGiftCard,
  addLine,
  addPromotion,
  changeLine,
  removeGiftCard,
  removePromotion,
} from "@/lib/cart/cart"
import { linkCartRefusal } from "@/lib/cart/payment-link"
import { isStoreApiError } from "@/lib/store-api/errors"

const AddToCart = z.object({
  variant_id: z.string().regex(/^variant_[0-9A-Za-z]{10,64}$/),
  quantity: z.coerce.number().int().min(1).max(99),
})

/** The messages a theme can show for a failed add; anything else is `cart.add_failed`. */
function messageFor(error: unknown): string {
  if (!isStoreApiError(error)) {
    return "cart.add_failed"
  }
  if (error.status === 429) {
    return "errors.too_many_requests"
  }
  // The cart is a payment link's (adr/0051): nothing goes in while it is
  const locked = linkCartRefusal(error)
  if (locked) {
    return locked
  }
  return error.status === 400 || error.status === 404
    ? "cart.variant_unavailable"
    : "cart.add_failed"
}

/**
 * Adds a variant to the shopper's cart (adr/0046 §5): a Server Action, so
 * Next checks the request came from our own pages; only the variant and
 * the quantity are taken, the price is the backend's.
 */
export async function addToCart(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = AddToCart.safeParse({
    variant_id: form.get("variant_id"),
    quantity: form.get("quantity") ?? 1,
  })
  if (!parsed.success) {
    const quantityWrong = parsed.error.issues.some((issue) => issue.path[0] === "quantity")
    return {
      ok: false,
      error: quantityWrong ? "cart.quantity_invalid" : "cart.variant_unavailable",
    }
  }
  try {
    await addLine(parsed.data.variant_id, parsed.data.quantity)
  } catch (error) {
    return { ok: false, error: messageFor(error) }
  }
  // The header's cart count is part of every page
  revalidatePath("/", "layout")
  return { ok: true, error: null }
}

const ChangeLine = z.object({
  line_id: z.string().regex(/^cali_[0-9A-Za-z]{10,64}$/),
  quantity: z.coerce.number().int().min(0).max(99),
})

/**
 * Changes a cart line's quantity, or removes it with zero: a plain form,
 * so it works before the page's script loads. A failure comes back to the
 * cart with its message key in the address.
 */
export async function changeCartLine(form: FormData): Promise<void> {
  const parsed = ChangeLine.safeParse({
    line_id: form.get("line_id"),
    quantity: form.get("remove") === "1" ? 0 : form.get("quantity"),
  })
  if (!parsed.success) {
    redirect("/sepet?hata=cart.quantity_invalid")
  }
  try {
    await changeLine(parsed.data.line_id, parsed.data.quantity)
  } catch (error) {
    // An add-on line holds no more units than its picks allow (adr/0052); a
    // payment link's cart keeps its lines as they are (adr/0051)
    const key = isStoreApiError(error) ? error.messageKey : null
    const shown =
      key === "addons.max_quantity"
        ? key
        : (linkCartRefusal(error) ??
          (messageFor(error) === "errors.too_many_requests"
            ? "errors.too_many_requests"
            : "cart.update_failed"))
    redirect(`/sepet?hata=${shown}`)
  }
  revalidatePath("/", "layout")
}

const PromotionCode = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[\p{L}\p{N}_-]+$/u)

/**
 * Puts a coupon code on the cart (D6): the code only; whether it takes
 * and what it takes off is the backend's (CLAUDE.md rule 5).
 */
export async function applyPromotion(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = PromotionCode.safeParse(form.get("code"))
  if (!parsed.success) {
    return { ok: false, error: "cart.promotion_invalid" }
  }
  try {
    if (!(await addPromotion(parsed.data))) {
      return { ok: false, error: "cart.promotion_invalid" }
    }
  } catch (error) {
    // Only the backend's answers are about the code; anything else is ours to see
    if (!isStoreApiError(error)) {
      throw error
    }
    return {
      ok: false,
      error:
        linkCartRefusal(error) ??
        (error.status === 429 ? "errors.too_many_requests" : "cart.promotion_invalid"),
    }
  }
  revalidatePath("/", "layout")
  return { ok: true, error: null }
}

/** Takes a code off the cart; a refusal goes back to the page the form was on, with its key. */
async function takePromotionOff(form: FormData, page: "/sepet" | "/odeme"): Promise<void> {
  const parsed = PromotionCode.safeParse(form.get("code"))
  if (parsed.success) {
    try {
      await removePromotion(parsed.data)
    } catch (error) {
      if (!isStoreApiError(error)) {
        throw error
      }
      redirect(`${page}?hata=${linkCartRefusal(error) ?? "cart.update_failed"}`)
    }
  }
  revalidatePath("/", "layout")
}

/** Takes a code off the cart; a plain form. */
export async function removeCartPromotion(form: FormData): Promise<void> {
  await takePromotionOff(form, "/sepet")
}

/** The same from the checkout's order summary: a refusal comes back to `/odeme`. */
export async function removeCheckoutPromotion(form: FormData): Promise<void> {
  await takePromotionOff(form, "/odeme")
}

// Our codes: a prefix and four groups of four (adr/0025); typed in any case, with or without dashes
const GiftCardCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{8,48}$/)

/** Puts a gift card on the cart (F4.8): the code only; its balance is the backend's. */
export async function applyGiftCard(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = GiftCardCode.safeParse(form.get("code"))
  if (!parsed.success) {
    return { ok: false, error: "cart.gift_card_invalid" }
  }
  try {
    if (!(await addGiftCard(parsed.data))) {
      return { ok: false, error: "cart.gift_card_invalid" }
    }
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return {
      ok: false,
      error: error.status === 429 ? "errors.too_many_requests" : "cart.gift_card_invalid",
    }
  }
  revalidatePath("/", "layout")
  return { ok: true, error: null }
}

/** Takes a gift card off the cart; a plain form. */
export async function removeCartGiftCard(form: FormData): Promise<void> {
  const parsed = GiftCardCode.safeParse(form.get("code"))
  if (parsed.success) {
    try {
      await removeGiftCard(parsed.data)
    } catch (error) {
      if (!isStoreApiError(error)) {
        throw error
      }
      redirect("/sepet?hata=cart.update_failed")
    }
  }
  revalidatePath("/", "layout")
}
