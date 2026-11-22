import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  CartPageView,
  CheckoutActions,
  CheckoutPageView,
  CheckoutSummaryView,
  ThemeActions,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0076 §6, K7, K11: the theme draws only the steps the view lists; a
 * cart nothing ships for has no shipping step, its address step asks for
 * the invoice and the contact, no shipping row in its totals. A view
 * without `steps` (and a shipped cart's) draws exactly as before.
 */

const actions: CheckoutActions = {
  saveAddress: () => Promise.resolve({ ok: true, error: null }),
  chooseShipping: () => Promise.resolve({ ok: true, error: null }),
  placeOrder: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  districts: () => Promise.resolve([]),
  neighborhoods: () => Promise.resolve([]),
}

const summary: CheckoutSummaryView = {
  lines: [
    { id: "cali_1", title: "Atölye", detail: null, quantity: 1, total: "500,00 TL", image: null },
  ],
  items: "500,00 TL",
  discount: null,
  shipping: null,
  total: "500,00 TL",
}

const view = (over: Partial<CheckoutPageView> = {}): CheckoutPageView => ({
  step: "address",
  address: {
    values: {
      email: "",
      phone: "",
      first_name: "",
      last_name: "",
      province: "",
      district: "",
      neighborhood: "",
      address_1: "",
    },
    provinces: [{ value: "20", label: "Denizli" }],
    districts: [],
    neighborhoods: [],
  },
  addressSummary: null,
  shippingOptions: [],
  shippingSelected: null,
  shippingSummary: null,
  paymentMethods: [],
  contracts: {},
  ageLimit: null,
  marketingVersion: "checkout-1",
  summary,
  error: null,
  editPaths: { address: "/odeme?adim=adres", shipping: "/odeme?adim=kargo", payment: "/odeme" },
  invoice: { text: "Faturanız bireysel olarak kesilir.", link: null },
  ...over,
})

const draw = (over: Partial<CheckoutPageView> = {}) =>
  renderPage(atolyeTheme, "CheckoutPage", { view: view(over), actions })

describe("the theme's checkout for a cart nothing ships for", () => {
  it("draws two steps: the invoice and contact, then the payment numbered 2", () => {
    const html = draw({
      steps: ["address", "payment"],
      summary: { ...summary, ships: false },
    })

    expect(html).toContain("İletişim ve fatura bilgileri")
    expect(html).toContain("Fatura adresi")
    expect(html).toContain("kargoyla gönderilmez")
    expect(html).toContain("Ödemeye geç")
    expect(html).not.toContain("Kargo seçeneklerine geç")
    expect(html).not.toContain("Teslimat adresi")
    expect(html).toContain('id="adim-2"')
    expect(html).not.toContain('id="adim-3"')
    // No shipping row in either summary
    expect(html).not.toContain("Sonraki adımda")
    // The same fields as a shipped cart's address (the backend asks for the country, iyzico an address)
    for (const field of ["email", "phone", "first_name", "last_name", "province", "address_1"]) {
      expect(html).toContain(`name="${field}"`)
    }
  })

  it("draws a view without steps, and a shipped cart's three, exactly as before", () => {
    const before = draw()

    expect(draw({ steps: ["address", "shipping", "payment"] })).toBe(before)
    expect(draw({ summary: { ...summary, ships: true } })).toBe(before)
    expect(before).toContain("İletişim ve teslimat adresi")
    expect(before).toContain("Kargo seçeneklerine geç")
    expect(before).toContain('id="adim-3"')
    expect(before).toContain("Sonraki adımda")
  })
})

const cartActions: ThemeActions = {
  addToCart: () => Promise.resolve({ ok: true, error: null }),
  changeCartLine: () => Promise.resolve(),
  applyPromotion: () => Promise.resolve({ ok: true, error: null }),
  removePromotion: () => Promise.resolve(),
  writeReview: () => Promise.resolve({ ok: true, error: null }),
  askQuestion: () => Promise.resolve({ ok: true, error: null }),
  stockAlert: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  addFavorite: () => Promise.resolve({ ok: true, error: null }),
  installments: () => Promise.resolve(null),
}

const cart = (over: Partial<CartPageView> = {}): CartPageView => ({
  lines: [
    {
      id: "cali_1",
      title: "Atölye",
      detail: null,
      quantity: 1,
      total: "500,00 TL",
      original: null,
      image: null,
      addons: [],
      nonWithdrawable: false,
    },
  ],
  items: "500,00 TL",
  discount: null,
  subtotal: "500,00 TL",
  promotions: [],
  freeShipping: null,
  error: null,
  ...over,
})

describe("the theme's cart for a cart nothing ships for", () => {
  it("draws no shipping row; a shipped cart's as before", () => {
    const shipped = renderPage(atolyeTheme, "CartPage", { view: cart(), actions: cartActions })
    const unshipped = renderPage(atolyeTheme, "CartPage", {
      view: cart({ ships: false }),
      actions: cartActions,
    })

    expect(shipped).toContain("Ödeme adımında")
    expect(unshipped).not.toContain("Ödeme adımında")
    expect(
      renderPage(atolyeTheme, "CartPage", { view: cart({ ships: true }), actions: cartActions })
    ).toBe(shipped)
  })
})
