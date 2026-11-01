"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ActionResult } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall, storeDelete, storePost } from "@/lib/store-api/server"

/** A signed-in customer saves a product (F10 wishlist); a guest is asked to sign in. */
export async function addFavorite(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = z
    .string()
    .regex(/^prod_[0-9A-Za-z]{10,64}$/)
    .safeParse(form.get("product_id"))
  if (!parsed.success) {
    return { ok: false, error: "product.favorite_failed" }
  }
  try {
    await storePost("/store/customers/me/wishlist", { product_id: parsed.data })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return {
      ok: false,
      error:
        error.status === 401
          ? "product.sign_in_first"
          : error.messageKey === "wishlist.full"
            ? "wishlist.full"
            : "product.favorite_failed",
    }
  }
  revalidatePath("/hesap/favoriler")
  return { ok: true, error: null }
}

export async function removeFavorite(form: FormData): Promise<void> {
  const parsed = z
    .string()
    .regex(/^[\w-]{1,80}$/)
    .safeParse(form.get("id"))
  if (parsed.success) {
    await storeDelete(`/store/customers/me/wishlist/${parsed.data}`).catch((error: unknown) => {
      if (!isStoreApiError(error)) {
        throw error
      }
    })
  }
  revalidatePath("/hesap/favoriler")
}

const Billing = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("individual"),
    legal_name: z.string().trim().min(2).max(200),
    tax_id: z
      .string()
      .transform((value) => value.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{11}$/)),
  }),
  z.object({
    type: z.literal("corporate"),
    legal_name: z.string().trim().min(2).max(200),
    tax_office: z.string().trim().min(2).max(100),
    tax_id: z
      .string()
      .transform((value) => value.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{10,11}$/)),
  }),
])

/**
 * The invoice details (F8): an individual's TCKN or a company's tax office
 * and VKN; the backend checks the number and keeps it encrypted, answering
 * it masked.
 */
export async function saveBilling(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const input = Object.fromEntries(form)
  const parsed = Billing.safeParse(
    input["type"] === "individual"
      ? { type: input["type"], legal_name: input["legal_name"], tax_id: input["tax_id"] }
      : input
  )
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "")
    return {
      ok: false,
      error:
        field === "tax_office"
          ? "billing_profile.tax_office_required"
          : "billing_profile.tax_id_invalid",
    }
  }
  try {
    await storeCall("/store/customers/me/billing-profile", { method: "POST", body: parsed.data })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    const key = error.messageKey ?? ""
    return { ok: false, error: key.startsWith("billing_profile.") ? key : "account.save_failed" }
  }
  revalidatePath("/hesap/bilgiler")
  return { ok: true, error: null }
}
