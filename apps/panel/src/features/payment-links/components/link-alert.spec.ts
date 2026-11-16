import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import { paymentLinkAlert } from "./link-alert"

const t = i18next.t.bind(i18next)

describe("paymentLinkAlert (the bell, adr/0051)", () => {
  it("leads a paid link to its order", () => {
    const alert = paymentLinkAlert(t, {
      kind: "payment_link_paid",
      payment_link_id: "plink_01",
      number: "PL-1042",
      order_id: "order_1",
    })
    expect(alert?.title).toBe("Ödeme bağlantısı PL-1042 ödendi")
    expect(alert?.link).toEqual({ to: "/orders/$id", search: {}, params: { id: "order_1" } })
  })

  it("leads an order to check for a second charge to that order", () => {
    const alert = paymentLinkAlert(t, {
      kind: "payment_link_needs_review",
      payment_link_id: "plink_01",
      number: "PL-1042",
      order_id: "order_2",
    })
    expect(alert?.title).toBe("Ödeme bağlantısı PL-1042: siparişi kontrol edin")
    expect(alert?.link).toEqual({ to: "/orders/$id", search: {}, params: { id: "order_2" } })
  })

  it("leads a repriced or short link to the link, to make it again", () => {
    const prices = paymentLinkAlert(t, {
      kind: "payment_link_prices_changed",
      payment_link_id: "plink_01",
      number: "PL-1042",
    })
    const stock = paymentLinkAlert(t, {
      kind: "payment_link_out_of_stock",
      payment_link_id: "plink_01",
      number: "PL-1042",
    })
    expect(prices?.title).toBe("Ödeme bağlantısı PL-1042: fiyatlar değişti")
    expect(stock?.title).toBe("Ödeme bağlantısı PL-1042: stokta olmayan ürün")
    for (const alert of [prices, stock]) {
      expect(alert?.link).toEqual({
        to: "/payment-links/$id",
        search: {},
        params: { id: "plink_01" },
      })
    }
  })

  it("leaves every other alert to the bell", () => {
    expect(paymentLinkAlert(t, { kind: "low_stock" })).toBeNull()
  })
})
