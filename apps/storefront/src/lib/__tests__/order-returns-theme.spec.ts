import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { baseTheme } from "@qticaret/theme-base"
import type { OrderActions, OrderPageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import type { StoreOrder } from "@/lib/orders/order"
import { orderView } from "@/lib/views/order"

/**
 * adr/0025 (2026-11-03) as the base theme prints the order page: a gift
 * card line's withdrawal on an order nothing was shipped for, in a form of
 * its own with no exchange and the right of withdrawal as its only reason.
 */

const actions: OrderActions = {
  cancelOrder: () => Promise.resolve(),
  requestReturn: () => Promise.resolve({ ok: true, error: null }),
}

const GIFT = "ordli_01K0000000000000000000GIFT"
const KNIFE = "ordli_01K000000000000000000KNIFE"

const lines: StoreOrder["items"] = [
  {
    id: KNIFE,
    title: "Çakı",
    subtitle: null,
    variant_title: "Siyah",
    thumbnail: null,
    quantity: 1,
    total: 1335,
    metadata: null,
  },
  {
    id: GIFT,
    title: "Hediye kartı",
    subtitle: null,
    variant_title: "500 TL",
    thumbnail: null,
    quantity: 1,
    total: 500,
    metadata: {
      qt_gift: { recipient_email: "zeynep@example.com" },
      qt_gift_cards: [{ id: "gc_1", last4: "AB12" }],
    },
  },
]

const order = (items: StoreOrder["items"], fulfillment: string): StoreOrder => ({
  id: "order_01K0000000000000000000ORDER",
  display_id: 1002,
  email: "ayse@example.com",
  created_at: "2026-11-03T10:00:00.000Z",
  status: "pending",
  payment_status: "captured",
  fulfillment_status: fulfillment,
  items,
  original_item_total: 1835,
  item_total: 1835,
  shipping_total: 0,
  total: 1835,
  shipping_address: null,
})

const page = (view: OrderPageView) =>
  renderToStaticMarkup(createElement(baseTheme.OrderPage, { t, view, actions }))

const forms = (html: string) => html.split("<form").slice(1)

describe("the base theme's order page for a gift card line", () => {
  it("offers the withdrawal on an order nothing was shipped for, without an exchange or a fault reason", () => {
    const html = page(orderView(order(lines.slice(1), "not_fulfilled"), null, false, t))
    const [form, ...rest] = forms(html)
    expect(rest).toHaveLength(0) // no cancel form: the cards went out
    expect(html).toContain("Hediye kartı için cayma talep et")
    expect(form).toContain(`name="qty_${GIFT}"`)
    expect(form).toContain("Kartlar iptal edilir ve ödediğiniz tutar iade edilir")
    expect(form).toContain('<input type="hidden" name="kind" value="return"/>')
    expect(form).not.toContain('value="exchange"')
    expect(form).toMatch(/<option value="changed_mind" selected="">Cayma hakkı \(vazgeçtim\)/)
    expect(form).not.toContain('value="damaged"')
  })

  it("makes the shopper pick the gift line or the shipped lines, each in its own form", () => {
    const html = page(orderView(order(lines, "delivered"), null, false, t))
    const [goods, gift] = forms(html)
    expect(html).toContain("İade ya da değişim talep et")
    expect(html).toContain("Hediye kartı diğer ürünlerle aynı talepte istenemez")
    expect(goods).toContain(`name="qty_${KNIFE}"`)
    expect(goods).not.toContain(`name="qty_${GIFT}"`)
    expect(goods).toContain('value="exchange"')
    expect(goods).toContain('value="damaged"')
    expect(gift).toContain(`name="qty_${GIFT}"`)
    expect(gift).not.toContain(`name="qty_${KNIFE}"`)
    expect(gift).not.toContain('value="exchange"')
  })

  it("says why a spent card's line cannot come back, with nothing to send", () => {
    const view = orderView(order(lines.slice(1), "not_fulfilled"), null, false, t)
    const html = page({
      ...view,
      returnable: [
        {
          id: GIFT,
          title: "Hediye kartı",
          quantity: 0,
          excluded: "gift_card_used",
          gift: true,
          note: t("order.return_gift_used"),
        },
      ],
    })
    expect(html).toContain("Kart kullanıldığı için cayma hakkı yok.")
    expect(forms(html)).toHaveLength(0)
  })
})
