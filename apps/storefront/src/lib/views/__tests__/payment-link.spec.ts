import { describe, expect, it } from "vitest"
import type { StorePaymentLink } from "@qticaret/types"
import { t } from "@/lib/i18n"
import {
  paymentLinkOutcomeOf,
  paymentLinkPath,
  paymentLinkTokenOf,
  paymentLinkView,
} from "../payment-link"

const TOKEN = `pl_${"A".repeat(20)}-_.mhx2k1.${"Zz_-".repeat(10)}abc`

const link = (overrides: Partial<StorePaymentLink> = {}): StorePaymentLink => ({
  number: "PL-1042",
  state: "open",
  first_name: "Ayşe",
  currency_code: "try",
  lines: [
    {
      variant_id: "variant_01",
      title: "Keten gömlek",
      variant_title: "M / Beyaz",
      thumbnail: "https://cdn.test/gomlek.webp",
      quantity: 2,
      unit_price: 75000,
      total: 150000,
      in_stock: true,
    },
    {
      variant_id: "variant_02",
      title: "Kemer",
      variant_title: null,
      thumbnail: null,
      quantity: 1,
      unit_price: 12550,
      total: 12550,
      in_stock: false,
    },
  ],
  items_total: 162550,
  discount_total: 16255,
  total: 146295,
  shipping: { preset: true },
  // 14:00 in Türkiye (UTC+3)
  expires_at: "2026-11-05T11:00:00.000Z",
  ...overrides,
})

const open = { token: TOKEN, outcome: null, replacesCart: false }

describe("the payment link's token and outcome", () => {
  it("takes only the backend's token shape", () => {
    expect(paymentLinkTokenOf(TOKEN)).toBe(TOKEN)
    expect(paymentLinkTokenOf("pl_short.abc.def")).toBeNull()
    expect(paymentLinkTokenOf(`${TOKEN}x`)).toBeNull()
    expect(paymentLinkTokenOf(TOKEN.replace("pl_", "cnt_"))).toBeNull()
    expect(paymentLinkTokenOf("<script>")).toBeNull()
    expect(paymentLinkTokenOf(["pl_"])).toBeNull()
  })

  it("writes the button's answer in Turkish words, and reads back only those", () => {
    expect(paymentLinkPath(TOKEN)).toBe(`/ode/${TOKEN}`)
    expect(paymentLinkPath(TOKEN, "prices_changed")).toBe(`/ode/${TOKEN}?durum=fiyat`)
    expect(paymentLinkPath(TOKEN, "out_of_stock")).toBe(`/ode/${TOKEN}?durum=stok`)
    expect(paymentLinkOutcomeOf("stok")).toBe("out_of_stock")
    expect(paymentLinkOutcomeOf("yok")).toBe("unavailable")
    expect(paymentLinkOutcomeOf("baska")).toBeNull()
    expect(paymentLinkOutcomeOf(undefined)).toBeNull()
  })
})

describe("paymentLinkView", () => {
  it("shows the order in words, kuruş as lira, the end in Türkiye's time, and the button", () => {
    const view = paymentLinkView(link(), open, t)

    expect(view.notice).toBeNull()
    expect(view.pay).toEqual({ fields: [{ name: "token", value: TOKEN }], warning: null })
    expect(view.order).toEqual({
      number: "PL-1042",
      firstName: "Ayşe",
      lines: [
        {
          title: "Keten gömlek",
          detail: "M / Beyaz",
          quantity: 2,
          unitPrice: "750,00 TL",
          total: "1.500,00 TL",
          image: {
            src: "https://cdn.test/gomlek.webp",
            alt: "Keten gömlek",
            width: null,
            height: null,
            sources: { avif: null, webp: null },
          },
          inStock: true,
        },
        {
          title: "Kemer",
          detail: null,
          quantity: 1,
          unitPrice: "125,50 TL",
          total: "125,50 TL",
          image: null,
          inStock: false,
        },
      ],
      items: "1.625,50 TL",
      discount: "162,55 TL",
      total: "1.462,95 TL",
      shippingPreset: true,
      expires: "5 Kasım 2026 14:00",
    })
  })

  it("leaves out a discount the link does not give, and a blank name", () => {
    const order = paymentLinkView(link({ discount_total: 0, first_name: "  " }), open, t).order
    expect(order?.discount).toBeNull()
    expect(order?.firstName).toBeNull()
  })

  it("warns that pressing replaces a cart with lines", () => {
    const view = paymentLinkView(link(), { ...open, replacesCart: true }, t)
    expect(view.pay?.warning).toBe("Sepetinizdeki ürünlerin yerini bu sipariş alacak.")
  })

  it("explains prices that moved, with no button", () => {
    const view = paymentLinkView(link({ state: "prices_changed" }), open, t)
    expect(view.order?.number).toBe("PL-1042")
    expect(view.notice).toBe(
      "Bu siparişteki fiyatlar değişti. Mağazaya bildirildi; size yeni bir ödeme bağlantısı gönderilecek."
    )
    expect(view.pay).toBeNull()
  })

  it("says what the button came back with; a button again only where pressing later helps", () => {
    const after = (outcome: Parameters<typeof paymentLinkView>[1]["outcome"]) =>
      paymentLinkView(link(), { ...open, outcome }, t)

    expect(after("prices_changed").notice).toMatch(/fiyatlar değişti/)
    expect(after("prices_changed").pay).toBeNull()
    expect(after("out_of_stock").notice).toBe(
      "Siparişteki bir ürün tükendi. Mağazaya bildirildi; sizinle iletişime geçilecek."
    )
    expect(after("out_of_stock").pay).toBeNull()
    expect(after("busy").notice).toMatch(/çok deneme/)
    expect(after("busy").pay).not.toBeNull()
    expect(after("failed").notice).toMatch(/açılamadı/)
    expect(after("failed").pay).not.toBeNull()
  })

  it("shows nothing of a link that opens nothing, whatever the reason", () => {
    const none = { order: null, notice: null, pay: null }
    expect(paymentLinkView(null, open, t)).toEqual(none)
    expect(paymentLinkView(link(), { ...open, outcome: "unavailable" }, t)).toEqual(none)
  })
})
