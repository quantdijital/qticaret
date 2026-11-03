import type { TFunction } from "i18next"
import { errorText } from "@/lib/errors"

/** The server's refusal of a cancel once a gift card of the order was spent (adr/0025 Ek 2026-11-03). */
export const GIFT_CARD_USED = "orders.gift_card_used"

/**
 * `POST /admin/orders/:id/cancel`, not through the SDK: its error keeps
 * only the sentence (written for the shopper), and the panel needs the
 * backend's key beside it (`code`, adr/0021) to say a gift card refusal in
 * staff's words. A refusal has the shape `errorText` reads, its key added.
 */
export async function cancelOrder(id: string): Promise<void> {
  const response = await fetch(`/admin/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: "{}",
  })
  if (response.ok) {
    return
  }
  const data = (await response.json().catch(() => null)) as {
    message?: unknown
    code?: unknown
  } | null
  const message = typeof data?.message === "string" ? data.message : response.statusText
  throw Object.assign(new Error(message), {
    status: response.status,
    message,
    code: typeof data?.code === "string" ? data.code : null,
  })
}

/** Whether the cancel was refused because a gift card of the order was spent or closed. */
export function giftCardUsed(error: unknown): boolean {
  const failure = error as { code?: unknown; message?: unknown } | null
  return failure?.code === GIFT_CARD_USED || failure?.message === GIFT_CARD_USED
}

/** Why a cancel failed, in words; a spent gift card in staff's words, not the shopper's. */
export function cancelFailureText(t: TFunction, failure: unknown): string {
  return giftCardUsed(failure) ? t("orders.cancel.giftUsed") : errorText(t, failure)
}
