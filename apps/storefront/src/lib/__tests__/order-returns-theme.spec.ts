import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { OrderActions, OrderPageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import type { ReturnableRow, StoreOrder } from "@/lib/orders/order"
import { orderView } from "@/lib/views/order"
import { GIFT, KNIFE, found, giftLine, knifeLine, order, row } from "@/test/order-fixtures"

/**
 * adr/0025 (2026-11-03) as the theme prints the order page: a gift
 * card line's withdrawal on an order nothing was shipped for, in a form of
 * its own with no exchange and the right of withdrawal as its only reason;
 * the order's cancel while its cards are untouched, saying they are voided.
 */

const actions: OrderActions = {
  cancelOrder: () => Promise.resolve(),
  requestReturn: () => Promise.resolve({ ok: true, error: null }),
}

const render = (o: StoreOrder, returnable: ReturnableRow | null) =>
  renderToStaticMarkup(
    createElement(atolyeTheme.OrderPage, {
      t,
      actions,
      view: orderView(o, null, false, t, {
        token: null,
        contracts: [],
        returns: [],
        returnable,
        shipments: [],
        invoice: null,
        note: null,
      }),
    })
  )

const page = (view: OrderPageView) =>
  renderToStaticMarkup(createElement(atolyeTheme.OrderPage, { t, view, actions }))

const forms = (html: string) => html.split("<form").slice(1)

const GIFT_CANCEL = "Gönderilen hediye kartları iptal edilir ve ödediğiniz tutar iade edilir."

describe("the order page for a gift card line", () => {
  it("offers the withdrawal on an order nothing was shipped for, without an exchange or a fault reason", () => {
    const html = render(order([giftLine(["AB12"])]), found([row(GIFT, 1, { gift_card: true })]))
    const [form, cancel, ...rest] = forms(html)
    expect(rest).toHaveLength(0)
    expect(html).toContain("Hediye kartı için cayma talep et")
    expect(form).toContain(`name="qty_${GIFT}"`)
    expect(form).toContain("Kartlar iptal edilir ve ödediğiniz tutar iade edilir")
    expect(form).toContain('<input type="hidden" name="kind" value="return"/>')
    expect(form).not.toContain('value="exchange"')
    expect(form).toMatch(/<option value="changed_mind" selected="">Cayma hakkı \(vazgeçtim\)/)
    expect(form).not.toContain('value="damaged"')
    // Its cards untouched, the order may still be cancelled, and says what that does
    expect(cancel).toContain("Siparişi iptal et")
    expect(cancel).toContain(GIFT_CANCEL)
  })

  it("makes the shopper pick the gift line or the shipped lines, each in its own form", () => {
    const html = render(
      order([knifeLine, giftLine(["AB12"])], "delivered"),
      found([row(KNIFE, 1), row(GIFT, 1, { gift_card: true })])
    )
    const [goods, gift, ...rest] = forms(html)
    expect(rest).toHaveLength(0) // shipped: no cancel
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

  it("says why a spent card's line cannot come back, with nothing to send and no cancel", () => {
    const html = render(
      order([giftLine(["AB12"])]),
      found([row(GIFT, 0, { gift_card: true, reason: "gift_card_used" })])
    )
    expect(html).toContain("Kart kullanıldığı için cayma hakkı yok.")
    expect(forms(html)).toHaveLength(0)
  })

  it("drops the gift form once its period is over, the cancel staying while nothing was packed", () => {
    const html = render(
      order([giftLine(["AB12"])]),
      found([row(GIFT, 0, { gift_card: true })], { window_open: false })
    )
    expect(html).not.toContain("Hediye kartı için cayma talep et")
    const [cancel, ...rest] = forms(html)
    expect(rest).toHaveLength(0)
    expect(cancel).toContain(GIFT_CANCEL)
  })

  it("keeps the plain cancel words for an order without gift lines", () => {
    const html = render(order([knifeLine]), found([row(KNIFE, 0)], { window_open: false }))
    const [cancel, ...rest] = forms(html)
    expect(rest).toHaveLength(0)
    expect(cancel).toContain(t("order.cancel_text"))
    expect(cancel).not.toContain(GIFT_CANCEL)
  })

  it("falls back to the plain words for a view that brings none of its own", () => {
    const view = orderView(order([knifeLine]), null, false, t)
    const bare: OrderPageView = { ...view }
    delete bare.cancelText
    expect(forms(page(bare))[0]).toContain(t("order.cancel_text"))
  })
})
