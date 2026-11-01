"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import type { ActionResult } from "@qticaret/ui"
import { addLine, changeLine } from "@/lib/cart/cart"
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
    redirect(
      `/sepet?hata=${messageFor(error) === "errors.too_many_requests" ? "errors.too_many_requests" : "cart.update_failed"}`
    )
  }
  revalidatePath("/", "layout")
}
