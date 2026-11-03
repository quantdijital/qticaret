import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { baseTheme } from "@qticaret/theme-base"
import type { CartPageView, PaymentLinkPageView, ThemeActions } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * adr/0051 as the base theme prints it: the link's page in each state and
 * a link's cart without its controls, all without a script.
 */

const noop = () => Promise.resolve()
const stateless = () => Promise.resolve({ ok: true, error: null })
const actions: ThemeActions = {
  addToCart: stateless,
  changeCartLine: noop,
  applyPromotion: stateless,
  removePromotion: noop,
  writeReview: stateless,
  askQuestion: stateless,
  stockAlert: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  addFavorite: stateless,
  installments: () => Promise.resolve(null),
  leaveLinkCart: noop,
}

const order: NonNullable<PaymentLinkPageView["order"]> = {
  number: "PL-1042",
  firstName: "Ayşe",
  lines: [
    {
      title: "Keten gömlek",
      detail: "M / Beyaz",
      quantity: 2,
      unitPrice: "750,00 TL",
      total: "1.500,00 TL",
      image: null,
      inStock: false,
    },
  ],
  items: "1.500,00 TL",
  discount: "150,00 TL",
  total: "1.350,00 TL",
  shippingPreset: false,
  expires: "5 Kasım 2026 14:00",
}

const linkPage = (view: PaymentLinkPageView) =>
  renderToStaticMarkup(createElement(baseTheme.PaymentLinkPage, { t, view, action: noop }))

describe("the base theme's payment link page", () => {
  it("greets, names the order, lists it with its totals and end, and offers the button", () => {
    const html = linkPage({
      order,
      notice: null,
      pay: { fields: [{ name: "token", value: "pl_x.y.z" }], warning: null },
    })
    expect(html).toContain("Merhaba Ayşe,")
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Sipariş PL-1042<\/h1>/)
    expect(html).toContain("2 × 750,00 TL")
    expect(html).toContain("Şu anda stokta yok")
    expect(html).toContain("−150,00 TL")
    expect(html).toContain("1.350,00 TL")
    expect(html).toContain("Ödeme adımında seçilir")
    expect(html).toContain("Son ödeme: 5 Kasım 2026 14:00 (Türkiye saati)")
    expect(html).toContain('<input type="hidden" name="token" value="pl_x.y.z"/>')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Ödemeye geç/)
  })

  it("explains moved prices without a button", () => {
    const html = linkPage({ order, notice: t("payment_link.prices_changed"), pay: null })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Mağazaya bildirildi")
    expect(html).not.toContain("<form")
  })

  it("says a link that opens nothing cannot be used, and leads home", () => {
    const html = linkPage({ order: null, notice: null, pay: null })
    expect(html).toMatch(/<h1[^>]*>Bu ödeme bağlantısı kullanılamıyor<\/h1>/)
    expect(html).toContain('href="/"')
    expect(html).not.toContain("<form")
    expect(html).not.toContain("PL-")
  })
})

const cart: CartPageView = {
  lines: [
    {
      id: "cali_1",
      title: "Keten gömlek",
      detail: "M / Beyaz",
      quantity: 2,
      total: "1.350,00 TL",
      original: "1.500,00 TL",
      image: null,
      addons: [],
      nonWithdrawable: false,
    },
  ],
  items: "1.500,00 TL",
  discount: "150,00 TL",
  subtotal: "1.350,00 TL",
  promotions: [],
  freeShipping: null,
  error: null,
}

const cartPage = (view: CartPageView) =>
  renderToStaticMarkup(createElement(baseTheme.CartPage, { t, view, actions }))

describe("the base theme's cart for a payment link's cart", () => {
  it("shows the lines as they are, with the note and the way out, and no controls", () => {
    const html = cartPage({ ...cart, locked: t("cart.payment_link_note") })
    expect(html).toContain("ödeme bağlantısından geldi")
    expect(html).toContain("Adet: 2")
    expect(html).toContain("1.350,00 TL")
    expect(html).toContain("sepeti boşalt")
    expect(html).not.toContain('name="remove"')
    expect(html).not.toContain('name="quantity"')
    expect(html).not.toContain('name="line_id"')
    expect(html).not.toContain(t("cart.promotion_label"))
    // Checkout stays open: address, shipping and payment are the customer's
    expect(html).toContain('href="/odeme"')
  })

  it("keeps every control on any other cart", () => {
    const html = cartPage(cart)
    expect(html).toContain('name="remove"')
    expect(html).toContain('name="quantity"')
    expect(html).toContain(t("cart.promotion_label"))
    expect(html).not.toContain("sepeti boşalt")
  })
})

describe("the words for a payment link", () => {
  it("has every message the storefront and the theme ask for", () => {
    const keys = [
      "payment_link.title",
      "payment_link.unavailable_title",
      "payment_link.unavailable_text",
      "payment_link.out_of_stock",
      "payment_link.busy",
      "payment_link.failed",
      "payment_link.replaces_cart",
      "payment_link.shipping_preset",
      "cart.payment_link_note",
      "cart.payment_link_leave",
      "cart.payment_link_locked",
      "cart.payment_link_closed",
      "cart.payment_link_superseded",
      "cart.payment_link_changed",
      "cart.payment_link_prices_changed",
      "cart.payment_link_code_misused",
      "cart.payment_link_no_cod",
    ]
    for (const key of keys) {
      expect(t(key), key).not.toBe(key)
    }
  })
})
