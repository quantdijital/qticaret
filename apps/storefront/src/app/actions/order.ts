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
 * The backend's cancel refusals the page says in its own words (`?durum=`):
 * a gift card the order sent was used (adr/0025, 2026-11-03); money taken
 * by hand (a bank transfer) goes back through the shop; a refund of the
 * order still being settled waits a few minutes. Any other refusal is the
 * general one.
 */
const CANCEL_REFUSALS: Readonly<Record<string, string>> = {
  "orders.gift_card_used": "iptal-hediye-karti",
  "orders.cancel_contact_shop": "iptal-magaza",
  "orders.refund_unsettled": "iptal-iade-isleniyor",
  "booking.use_booking_cancel": "iptal-rezervasyon",
  // adr/0076 Ek basit yol: the shop takes a dated order's cancel by phone or e-mail
  "booking.cancel_by_contact": "rezervasyon-iletisim",
}

/**
 * The shopper cancels their own order before it is packed (F7.13): signed
 * in, or with the order's key from its link. What was paid comes back; a
 * gift card the order sent is voided, while none was used.
 */
export async function cancelOrder(form: FormData): Promise<void> {
  const parsed = z.object({ order_id: ORDER_ID, token: TOKEN }).safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    redirect("/")
  }
  const { order_id, token } = parsed.data
  let note = "iptal"
  try {
    await storeCall(`/store/orders/${encodeURIComponent(order_id)}/cancel`, {
      method: "POST",
      body: {},
      headers: keyed(token),
    })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    note = (error.messageKey ? CANCEL_REFUSALS[error.messageKey] : undefined) ?? "iptal-olmadi"
  }
  revalidatePath(`/siparis/${order_id}`)
  redirect(back(order_id, token, note))
}

const SLOT_ID = z.string().regex(/^bkslot_[A-Za-z0-9]{1,40}$/)

/** A departure cancel's refusals the page says in its own words (`?durum=`). */
const BOOKING_REFUSALS: Readonly<Record<string, string>> = {
  "booking.cancel_too_late": "rezervasyon-gec",
  "booking.cancel_unavailable": "rezervasyon-kademe-yok",
  "orders.cancel_contact_shop": "rezervasyon-magaza",
  "booking.cancel_by_contact": "rezervasyon-iletisim",
}

/**
 * The shopper cancels one departure of their dated order (adr/0076 Ek
 * D7a), after the page showed what comes back: only the departure is
 * sent; the backend works the refund out by the product's tiers.
 */
export async function cancelBooking(form: FormData): Promise<void> {
  const parsed = z
    .object({ order_id: ORDER_ID, token: TOKEN, slot_id: SLOT_ID })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    redirect("/")
  }
  const { order_id, token, slot_id } = parsed.data
  let note = "rezervasyon-iptal"
  try {
    await storeCall(`/store/orders/${encodeURIComponent(order_id)}/bookings/cancel`, {
      method: "POST",
      body: { slot_id },
      headers: keyed(token),
    })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    note =
      (error.messageKey ? BOOKING_REFUSALS[error.messageKey] : undefined) ??
      "rezervasyon-iptal-olmadi"
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
 * The backend's refusals the form says in its own words: a line made to the
 * buyer's wish back only as faulty or wrong (adr/0052 §8); a gift card line
 * whose cards were spent, or asked with other lines or as an exchange
 * (adr/0025, 2026-11-03); a request still open.
 */
const SAID = new Set([
  "returns.withdrawal_excluded",
  "returns.gift_card_used",
  "returns.gift_card_separate",
  "returns.already_open",
  // An exchange's variant (adr/0032 §6): out of stock, the same one, not the product's, discounted
  "returns.exchange_out_of_stock",
  "returns.exchange_same_variant",
  "returns.exchange_variant_invalid",
  "returns.exchange_discounted_price",
])

const VARIANT_ID = /^variant_[0-9A-Za-z]{1,40}$/

/**
 * Asks to send lines back (F7.9): each line with the quantity chosen, a
 * reason and a note; the shop decides. Signed in or with the order's key.
 * An exchange (adr/0032 §6) sends each line's variant (`variant_<line>`),
 * never a price: the backend quotes the swap. A gift card line's form asks
 * for it alone, as money back (`kind=return`).
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
  // An exchange names the variant each line goes back for; a return names none
  const variantOf = (line: string) => {
    const value = form.get(`variant_${line}`)
    return typeof value === "string" && VARIANT_ID.test(value) ? value : null
  }
  if (kind === "exchange" && items.some((item) => variantOf(item.line_item_id) === null)) {
    return { ok: false, error: "order.return_variant_required" }
  }
  const lines =
    kind === "exchange"
      ? items.map((item) => ({ ...item, variant_id: variantOf(item.line_item_id) ?? "" }))
      : items
  try {
    await storeCall(`/store/orders/${encodeURIComponent(order_id)}/returns`, {
      method: "POST",
      body: { kind, items: lines, reason, ...(note ? { note } : {}) },
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
          : error.messageKey && SAID.has(error.messageKey)
            ? error.messageKey
            : "order.return_failed",
    }
  }
  revalidatePath(`/siparis/${order_id}`)
  return { ok: true, error: null }
}
