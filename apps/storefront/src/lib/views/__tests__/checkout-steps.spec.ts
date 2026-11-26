import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CheckoutCart, CheckoutCartLine } from "@/lib/checkout/cart"
import type * as Options from "@/lib/checkout/options"
import type * as LinePaths from "../line-paths"

const calls = vi.hoisted(() => ({
  shippingOptions: vi.fn(),
  paymentMethods: vi.fn(),
}))
vi.mock("@/lib/checkout/address", () => ({
  provinceOptions: () => Promise.resolve([{ value: "20", label: "Denizli" }]),
  districtOptions: () => Promise.resolve([]),
  neighborhoodOptions: () => Promise.resolve([]),
  selectsOf: () => Promise.resolve({ province: "20", district: "", neighborhood: "" }),
}))
vi.mock("@/lib/checkout/options", async (actual) => ({
  ...(await actual<typeof Options>()),
  shippingOptions: (cartId: string) => {
    calls.shippingOptions(cartId)
    return Promise.resolve([{ id: "so_1", name: "Yurtiçi", amount: 90 }])
  },
  paymentMethods: (cartId: string) => {
    calls.paymentMethods(cartId)
    return Promise.resolve({
      card_providers: ["pp_iyzico_iyzico"],
      card_providers_down: [],
      bank_transfer: null,
      cash_on_delivery: null,
    })
  },
  maxInstallments: () => Promise.resolve(1),
  ageCheck: () => Promise.resolve({ required: false, declared: false, min_age: null }),
  contracts: () => Promise.resolve([]),
}))
vi.mock("../line-paths", async (actual) => ({
  ...(await actual<typeof LinePaths>()),
  productPathsOf: () => Promise.resolve(new Map()),
  linePicturesOf: () => Promise.resolve(new Map()),
}))

const { t } = await import("@/lib/i18n")
const { cartShips } = await import("@/lib/cart/ships")
const { checkoutView, stepOf, stepsOf } = await import("../checkout")
const { afterAddressPath } = await import("../checkout-steps")
const { miniCartOf } = await import("../cart")

const line = (id: string, requires_shipping?: boolean): CheckoutCartLine => ({
  id,
  title: id,
  subtitle: null,
  variant_title: null,
  thumbnail: null,
  quantity: 1,
  total: 500,
  ...(requires_shipping === undefined ? {} : { requires_shipping }),
})

const ADDRESS = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "05320000000",
  address_1: "Cumhuriyet Cad. No: 12",
  address_2: "Sırakapılar",
  city: "Merkezefendi",
  province: "Denizli",
  postal_code: "20010",
  country_code: "tr",
}

const cart = (items: CheckoutCartLine[], over: Partial<CheckoutCart> = {}): CheckoutCart => ({
  id: "cart_1",
  email: "ayse@quantdijital.com",
  completed_at: null,
  shipping_address: ADDRESS,
  shipping_methods: [],
  items,
  original_item_total: 500,
  item_total: 500,
  shipping_total: 0,
  total: 500,
  ...over,
})

const SHIPPED = [line("kupa")]
const UNSHIPPED = [line("atolye", false), line("hediye-karti", false)]
const MIXED = [line("kupa", true), line("atolye", false)]
const CHOSEN = [{ id: "sm_1", shipping_option_id: "so_1", name: "Yurtiçi", total: 90 }]

/** adr/0076 §6, K7, K11: the steps a cart takes come from what it ships. */
describe("checkout steps from the cart", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps all three for a shipped cart and a mixed one, a line without the field shipped", () => {
    expect(stepsOf(cart(SHIPPED))).toEqual(["address", "shipping", "payment"])
    expect(stepsOf(cart(MIXED))).toEqual(["address", "shipping", "payment"])
    expect(cartShips([])).toBe(true)
    expect(afterAddressPath(cart(SHIPPED))).toBe("/odeme?adim=kargo")
  })

  it("takes two steps for a cart nothing ships for: the address goes on to the payment", () => {
    expect(stepsOf(cart(UNSHIPPED))).toEqual(["address", "payment"])
    expect(afterAddressPath(cart(UNSHIPPED))).toBe("/odeme")
  })

  it("opens a shipped cart's steps as before: shipping until a method is chosen", () => {
    expect(stepOf(cart(SHIPPED), undefined)).toBe("shipping")
    expect(stepOf(cart(SHIPPED), "odeme")).toBe("shipping")
    expect(stepOf(cart(SHIPPED), "adres")).toBe("address")
    expect(stepOf(cart(SHIPPED, { shipping_methods: CHOSEN }), undefined)).toBe("payment")
    expect(stepOf(cart(SHIPPED, { shipping_address: null }), "odeme")).toBe("address")
    expect(stepOf(cart(MIXED), undefined)).toBe("shipping")
  })

  it("opens a cart nothing ships for at the payment once the address is in, never at shipping", () => {
    expect(stepOf(cart(UNSHIPPED), undefined)).toBe("payment")
    expect(stepOf(cart(UNSHIPPED), "kargo")).toBe("payment")
    expect(stepOf(cart(UNSHIPPED), "adres")).toBe("address")
    expect(stepOf(cart(UNSHIPPED, { shipping_address: null }), "odeme")).toBe("address")
  })

  it("loads the payment for a cart nothing ships for without a method, no carriers asked", async () => {
    const view = await checkoutView(cart(UNSHIPPED), "payment", null, t)

    expect(view.steps).toEqual(["address", "payment"])
    expect(view.paymentMethods.map((method) => method.id)).toEqual(["pp_iyzico_iyzico"])
    expect(view.shippingOptions).toEqual([])
    expect(calls.shippingOptions).not.toHaveBeenCalled()
    expect(view.summary.ships).toBe(false)
  })

  it("keeps a shipped cart's view as before: carriers offered, no payment before a method", async () => {
    const view = await checkoutView(cart(SHIPPED), "shipping", null, t)

    expect(view.steps).toEqual(["address", "shipping", "payment"])
    expect(view.shippingOptions.map((option) => option.id)).toEqual(["so_1"])
    expect(view.paymentMethods).toEqual([])
    expect(calls.paymentMethods).not.toHaveBeenCalled()
    expect(view.summary).not.toHaveProperty("ships")
    expect(view.summary.shipping).toBeNull()

    const mixed = await checkoutView(cart(MIXED), "shipping", null, t)
    expect(mixed.paymentMethods).toEqual([])
    expect(mixed.summary).not.toHaveProperty("ships")
  })

  it("draws no free shipping meter in the drawer for a cart nothing ships for", () => {
    const base = {
      currency_code: "try",
      completed_at: null,
      original_item_total: 500,
      item_total: 500,
      total: 500,
      promotions: [],
    }
    const drawerLine = (id: string, requires_shipping?: boolean) => ({
      ...line(id, requires_shipping),
      unit_price: 500,
      original_total: 500,
    })
    const shipped = miniCartOf({ ...base, id: "cart_1", items: [drawerLine("kupa")] }, 1000, t)
    const unshipped = miniCartOf(
      { ...base, id: "cart_2", items: [drawerLine("atolye", false)] },
      1000,
      t
    )

    expect(shipped?.freeShipping).not.toBeNull()
    expect(unshipped?.freeShipping).toBeNull()
    // Nor the drawer's "shipping is worked out at the payment step"
    expect(shipped).not.toHaveProperty("note")
    expect(unshipped?.note).toBe(t("cart.drawer_note_unshipped"))
    expect(unshipped?.note).not.toMatch(/Kargo/)

    // The server's estimate: a "Kargo" row, the note no longer says the payment step prices it
    const estimated = (items: ReturnType<typeof drawerLine>[]) =>
      miniCartOf(
        { ...base, id: "cart_3", items },
        1000,
        t,
        new Map(),
        new Map(),
        false,
        null,
        new Set(),
        "90,00 TL"
      )
    expect(estimated([drawerLine("kupa")])).toMatchObject({
      shipping: "90,00 TL",
      note: "İndirim kodunuz varsa sepette girin.",
    })
    expect(estimated([drawerLine("atolye", false)])).not.toHaveProperty("shipping")
  })
})
