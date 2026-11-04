import type { ReturnableLineRow, ReturnableRow, StoreOrder } from "@/lib/orders/order"

/*
 * An order and what its returnable route answers (adr/0025, 2026-11-03),
 * for the order page's specs: a physical line and a gift card line.
 */

export const GIFT = "ordli_01K0000000000000000000GIFT"
export const KNIFE = "ordli_01K000000000000000000KNIFE"

type Line = StoreOrder["items"][number]

/** A gift card line for two cards; `cards`: the last four of those issued. */
export const giftLine = (cards: string[]): Line => ({
  id: GIFT,
  title: "Hediye kartı",
  subtitle: null,
  variant_title: "500 TL",
  thumbnail: null,
  quantity: 2,
  total: 1000,
  metadata: {
    qt_gift: { recipient_email: "zeynep@example.com" },
    ...(cards.length ? { qt_gift_cards: cards.map((last4, i) => ({ id: `gc_${i}`, last4 })) } : {}),
  },
})

export const knifeLine: Line = {
  id: KNIFE,
  title: "Çakı",
  subtitle: null,
  variant_title: "Siyah",
  thumbnail: null,
  quantity: 1,
  total: 1335,
  metadata: null,
}

export const order = (
  items: Line[],
  fulfillment = "not_fulfilled",
  status = "pending"
): StoreOrder => ({
  id: "order_01K0000000000000000000ORDER",
  display_id: 1002,
  email: "ayse@example.com",
  created_at: "2026-11-03T10:00:00.000Z",
  status,
  payment_status: "captured",
  fulfillment_status: fulfillment,
  items,
  original_item_total: 2335,
  item_total: 2335,
  shipping_total: 0,
  total: 2335,
  shipping_address: null,
})

/** A line as the route gives it: `returnable` units left, a gift line, why it is out, its warning. */
export const row = (
  id: string,
  returnable: number,
  {
    gift_card = false,
    reason = null,
    warning = null,
  }: { gift_card?: boolean; reason?: string | null; warning?: string | null } = {}
): ReturnableLineRow => ({
  line_item_id: id,
  title: id === GIFT ? "Hediye kartı" : "Çakı",
  variant_title: id === GIFT ? "500 TL" : "Siyah",
  variant_id: id === GIFT ? "variant_gift" : "variant_knife",
  returnable,
  withdrawal_excluded: reason !== null,
  withdrawal_excluded_reason: reason,
  withdrawal_warning: warning,
  gift_card,
  variants: [],
})

/** The route's answer: the window open and no request open unless said. */
export const found = (
  lines: ReturnableLineRow[],
  { window_open = true, open_request = false, ...more }: Partial<Omit<ReturnableRow, "lines">> = {}
): ReturnableRow => ({ window_open, open_request, ...more, lines })
