import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as Pay from "@/lib/checkout/pay"
import type * as PlaceOrderModule from "@/lib/checkout/place-order"
import { StoreApiError } from "@/lib/store-api/errors"

const next = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: next.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: next.redirect }))
const checkout = vi.hoisted(() => ({ metadata: null as Record<string, unknown> | null }))
vi.mock("@/lib/checkout/cart", () => ({
  checkoutCart: () =>
    Promise.resolve({ id: "cart_1", total: 1335, items: [], metadata: checkout.metadata }),
}))
const BANK = "pp_bank-transfer_bank-transfer"
const COD = "pp_cod_cod"
// The backend judges cash on delivery for the cart: a link's only with the shop's `allow_cod` on
const shop = vi.hoisted(() => ({ allowCod: false }))
vi.mock("@/lib/checkout/options", () => ({
  CONTRACT_KINDS: ["pre_information", "distance_sales"],
  ageCheck: () => Promise.resolve({ required: false, declared: false }),
  paymentMethods: () =>
    Promise.resolve({
      bank_transfer: { provider_id: "pp_bank-transfer_bank-transfer" },
      cash_on_delivery:
        checkout.metadata?.["qt_payment_link"] && !shop.allowCod
          ? null
          : { provider_id: "pp_cod_cod", fee: "20.00" },
    }),
}))
vi.mock("@/lib/cart/cookie", () => ({ forgetCart: () => Promise.resolve() }))
vi.mock("@/lib/checkout/tracking", () => ({ recordTracking: () => Promise.resolve() }))
vi.mock("@/lib/views/checkout", () => ({ cardProviderOf: () => "pp_paytr_paytr" }))
const pay = vi.hoisted(() => ({
  startPayment: vi.fn(),
  completeCart: vi.fn(),
  orderAccess: vi.fn(),
}))
vi.mock("@/lib/checkout/pay", async (actual) => ({
  ...(await actual<typeof Pay>()),
  ...pay,
}))
vi.mock("@/lib/checkout/place-order", async (actual) => ({
  ...(await actual<typeof PlaceOrderModule>()),
  acceptTerms: () => Promise.resolve(null),
}))

const { placeOrder } = await import("../checkout")

const submit = (provider: string) => {
  const form = new FormData()
  form.set("provider_id", provider)
  return placeOrder({ ok: false, error: null, challenge: null }, form)
}

/** adr/0051 §4–§5: a payment link's cart at checkout. */
describe("placeOrder for a payment link's cart", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkout.metadata = { qt_payment_link: "plink_1" }
    shop.allowCod = false
  })

  it("takes no cash on delivery while the backend's methods leave it out: the payment is not started", async () => {
    await expect(submit(COD)).resolves.toMatchObject({ error: "checkout.payment_required" })
    expect(pay.startPayment).not.toHaveBeenCalled()
  })

  it("takes cash on delivery for a link's cart once the backend offers it (the shop allows it)", async () => {
    shop.allowCod = true
    pay.startPayment.mockResolvedValue({
      id: "ps_1",
      provider_id: COD,
      status: "pending",
      data: { method: "cash_on_delivery" },
    })
    pay.completeCart.mockResolvedValue("order_1")
    pay.orderAccess.mockResolvedValue({ id: "order_1", token: "tok" })
    await expect(submit(COD)).rejects.toThrow("redirect:/siparis/order_1?token=tok&yeni=1")
    expect(pay.startPayment).toHaveBeenCalledWith("cart_1", COD, null)
  })

  it("says the backend's refusal of cash on delivery at placement in its own words", async () => {
    // Offered when the page was drawn, turned off before the payment started
    shop.allowCod = true
    pay.startPayment.mockRejectedValue(new StoreApiError(400, "cart.payment_link_no_cod", null))
    await expect(submit(COD)).resolves.toEqual({
      ok: false,
      error: "cart.payment_link_no_cod",
      challenge: null,
    })
    expect(pay.completeCart).not.toHaveBeenCalled()
  })

  it("still takes cash on delivery for any other cart", async () => {
    checkout.metadata = null
    pay.startPayment.mockRejectedValue(new StoreApiError(400, "cash_on_delivery.disabled", null))
    await expect(submit(COD)).resolves.toMatchObject({ error: "checkout.cod_unavailable" })
    expect(pay.startPayment).toHaveBeenCalledTimes(1)
  })

  it.each([
    "cart.payment_link_closed",
    "cart.payment_link_superseded",
    "cart.payment_link_changed",
    "cart.payment_link_prices_changed",
    "cart.payment_link_code_misused",
    "cart.payment_link_no_cod",
  ])("says %s in its own words, at the start or the completion, never retried", async (key) => {
    pay.startPayment.mockRejectedValueOnce(new StoreApiError(400, key, null))
    await expect(submit(BANK)).resolves.toEqual({ ok: false, error: key, challenge: null })

    pay.startPayment.mockResolvedValueOnce({
      id: "ps_1",
      provider_id: BANK,
      status: "pending",
      data: { method: "bank_transfer" },
    })
    pay.completeCart.mockRejectedValueOnce(new StoreApiError(400, key, null))
    await expect(submit(BANK)).resolves.toMatchObject({ error: key })
    expect(pay.startPayment).toHaveBeenCalledTimes(2)
    expect(pay.completeCart).toHaveBeenCalledTimes(1)
    expect(next.redirect).not.toHaveBeenCalled()
  })
})
