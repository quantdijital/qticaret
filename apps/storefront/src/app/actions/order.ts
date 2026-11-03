"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"

const ORDER_ID = z.string().regex(/^order_[0-9A-Za-z]{10,64}$/)
const TOKEN = z
  .string()
  .regex(/^[0-9a-z]{1,12}\.[A-Za-z0-9_-]{43}$/)
  .optional()
  .or(z.literal("").transform(() => undefined))

const keyed = (token: string | undefined) => (token ? { "x-order-token": token } : {})

const back = (orderId: string, token: string | undefined, note: string) =>
  `/siparis/${orderId}?${token ? `token=${encodeURIComponent(token)}&` : ""}durum=${note}`

/**
 * The shopper cancels their own order before it is packed (F7.13): signed
 * in, or with the order's key from its link. What was paid comes back.
 */
export async function cancelOrder(form: FormData): Promise<void> {
  const parsed = z.object({ order_id: ORDER_ID, token: TOKEN }).safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    redirect("/")
  }
  const { order_id, token } = parsed.data
  let note = "iptal"
  try {
    await storeCall(`/store/orders/${order_id}/cancel`, {
      method: "POST",
      body: {},
      headers: keyed(token),
    })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    note = "iptal-olmadi"
  }
  revalidatePath(`/siparis/${order_id}`)
  redirect(back(order_id, token, note))
}

const REASONS = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "size_issue",
  "other",
] as const

/**
 * Asks to send lines back (F7.9): each line with the quantity chosen, a
 * reason and a note; the shop decides. Signed in or with the order's key.
 */
export async function requestReturn(
  _state: { ok: boolean; error: string | null },
  form: FormData
): Promise<{ ok: boolean; error: string | null }> {
  const parsed = z
    .object({
      order_id: ORDER_ID,
      token: TOKEN,
      kind: z.enum(["return", "exchange"]).default("return"),
      reason: z.enum(REASONS),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return { ok: false, error: "order.return_reason_required" }
  }
  const items = [...form.entries()].flatMap(([name, value]) => {
    const line = /^qty_(ordli_[0-9A-Za-z]{10,64})$/.exec(name)?.[1]
    const quantity = Number(value)
    return line && Number.isInteger(quantity) && quantity > 0 && quantity <= 999
      ? [{ line_item_id: line, quantity }]
      : []
  })
  if (items.length === 0) {
    return { ok: false, error: "order.return_items_required" }
  }
  const { order_id, token, kind, reason, note } = parsed.data
  try {
    await storeCall(`/store/orders/${order_id}/returns`, {
      method: "POST",
      body: { kind, items, reason, ...(note ? { note } : {}) },
      headers: keyed(token),
    })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return {
      ok: false,
      error:
        error.status === 429
          ? "errors.too_many_requests"
          : // A line made to the buyer's wish comes back only as faulty or wrong (adr/0052 §8)
            error.messageKey === "returns.withdrawal_excluded"
            ? "returns.withdrawal_excluded"
            : "order.return_failed",
    }
  }
  revalidatePath(`/siparis/${order_id}`)
  return { ok: true, error: null }
}
