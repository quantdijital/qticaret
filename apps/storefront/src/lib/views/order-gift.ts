import type { OrderGiftView } from "@qticaret/ui"

const LAST4 = /^[0-9A-Za-z]{4}$/

/**
 * A gift card line's cards and recipient (adr/0025 Ek 2026-11-03): the
 * last four of each card issued (`qt_gift_cards`; never the code) and the
 * address in `qt_gift` (gone once erased). Null on any other line.
 */
export function orderGiftOf(metadata: unknown): OrderGiftView | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null
  }
  const { qt_gift: gift, qt_gift_cards: cards } = metadata as Record<string, unknown>
  if (gift === undefined && cards === undefined) {
    return null
  }
  const email = (gift as { recipient_email?: unknown } | null)?.recipient_email
  return {
    cards: (Array.isArray(cards) ? cards : []).flatMap((card: unknown) => {
      const last4 = (card as { last4?: unknown } | null)?.last4
      return typeof last4 === "string" && LAST4.test(last4) ? [last4] : []
    }),
    recipient: typeof email === "string" && email.includes("@") ? email : null,
  }
}
