"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import type { ActionResult } from "@qticaret/ui"
import { addonError } from "@/lib/addons/errors"
import { linkCartRefusal } from "@/lib/cart/payment-link"
import { INSUFFICIENT_STOCK, isInsufficientStock } from "@/lib/cart/stock-refusal"
import { fieldOf, hasPicks, pickedLimit, selectionsOf } from "@/lib/addons/selections"
import { addAddonLine, productAddons, saveAddonLine } from "@/lib/cart/addons"
import { addLine } from "@/lib/cart/cart"
import { isStoreApiError } from "@/lib/store-api/errors"

const PRODUCT_ID = z.string().regex(/^prod_[0-9A-Za-z]{10,64}$/)

const AddLine = z.object({
  product_id: PRODUCT_ID,
  variant_id: z.string().regex(/^variant_[0-9A-Za-z]{10,64}$/),
  quantity: z.coerce.number().int().min(1).max(99),
})

/** A failed add in words: an add-on refusal by its key, the core add's as the plain form says it. */
function addFailure(error: unknown): string {
  const core = isInsufficientStock(error)
    ? INSUFFICIENT_STOCK
    : isStoreApiError(error) && (error.status === 400 || error.status === 404)
      ? "cart.variant_unavailable"
      : "cart.add_failed"
  return linkCartRefusal(error) ?? addonError(error, core)
}

/**
 * A product with its add-on picks into the cart (adr/0052): the picks are
 * checked against the product's add-ons as the backend gives them, then
 * the line is added and its picks written, priced on the server; a
 * refused pick takes the line back. Without picks it is a plain add.
 * Only the variant, the quantity and the picks are sent (CLAUDE.md rule 5).
 */
export async function addAddonsToCart(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = AddLine.safeParse({
    product_id: form.get("product_id"),
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
  const { product_id, variant_id, quantity } = parsed.data
  try {
    const addons = await productAddons(product_id)
    if (addons === null && hasPicks(form)) {
      // Picks the shop no longer takes: never dropped silently from a paid wish
      return { ok: false, error: "catalog.addons_disabled" }
    }
    const picked = selectionsOf(addons ?? [], fieldOf(form))
    if (!picked.ok) {
      return { ok: false, error: picked.error }
    }
    const limit = pickedLimit(addons ?? [], picked.selections)
    if (limit !== null && quantity > limit) {
      return { ok: false, error: "addons.max_quantity" }
    }
    if (picked.selections.length === 0) {
      await addLine(variant_id, quantity)
    } else {
      await addAddonLine(variant_id, quantity, picked.selections)
    }
  } catch (error) {
    return { ok: false, error: addFailure(error) }
  }
  // The header's cart count and drawer are part of every page
  revalidatePath("/", "layout")
  return { ok: true, error: null }
}

const SaveLine = z.object({
  line_id: z.string().regex(/^cali_[0-9A-Za-z]{10,64}$/),
  product_id: PRODUCT_ID,
})

/**
 * A cart line's picks from the cart: a plain form, so it works before the
 * page's script loads; `clear=1` takes them all off. A refusal comes back
 * to the cart with its message key in the address.
 */
export async function saveLineAddons(form: FormData): Promise<void> {
  const parsed = SaveLine.safeParse({
    line_id: form.get("line_id"),
    product_id: form.get("product_id"),
  })
  if (!parsed.success) {
    redirect("/sepet?hata=cart.update_failed")
  }
  let failed: string | null = null
  try {
    const addons = await productAddons(parsed.data.product_id)
    const picked =
      form.get("clear") === "1"
        ? ({ ok: true, selections: [] } as const)
        : selectionsOf(addons ?? [], fieldOf(form))
    if (addons === null) {
      failed = "catalog.addons_disabled"
    } else if (!picked.ok) {
      failed = picked.error
    } else {
      await saveAddonLine(parsed.data.line_id, picked.selections)
    }
  } catch (error) {
    failed = linkCartRefusal(error) ?? addonError(error, "cart.update_failed")
  }
  revalidatePath("/", "layout")
  redirect(failed ? `/sepet?hata=${failed}` : "/sepet")
}
