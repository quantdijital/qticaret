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
vi.mock("@/lib/checkout/cart", () => ({
  checkoutCart: () => Promise.resolve({ id: "cart_1", total: 1335, items: [] }),
}))
vi.mock("@/lib/checkout/options", () => ({
  CONTRACT_KINDS: ["pre_information", "distance_sales"],
  ageCheck: () => Promise.resolve({ required: false, declared: false }),
  paymentMethods: () =>
    Promise.resolve({ bank_transfer: { provider_id: "pp_bank-transfer_bank-transfer" } }),
}))
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

const BANK = "pp_bank-transfer_bank-transfer"

const submit = () => {
  const form = new FormData()
  form.set("provider_id", BANK)
  return placeOrder({ ok: false, error: null, challenge: null }, form)
}

/** adr/0052 §5: an add-on line whose price moved stops the payment; the shopper sees the new total first. */
describe("placeOrder with a price that moved", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pay.startPayment.mockResolvedValue({
      id: "ps_1",
      provider_id: BANK,
      status: "pending",
      data: { method: "bank_transfer" },
    })
  })

  it("draws the page again with the new totals and says so, without paying again by itself", async () => {
    pay.startPayment.mockRejectedValue(new StoreApiError(409, "cart.prices_changed", null))
    await expect(submit()).resolves.toEqual({
      ok: false,
      error: "cart.prices_changed",
      challenge: null,
    })
    expect(next.revalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(pay.startPayment).toHaveBeenCalledTimes(1)
    expect(next.redirect).not.toHaveBeenCalled()
  })

  it("does the same when the completion finds it (the next start puts the line right)", async () => {
    pay.completeCart.mockRejectedValue(new StoreApiError(409, "cart.prices_changed", null))
    await expect(submit()).resolves.toMatchObject({ error: "cart.prices_changed" })
    expect(pay.startPayment).toHaveBeenCalledTimes(1)
    expect(pay.completeCart).toHaveBeenCalledTimes(1)
    expect(next.revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it("says a pick to fix in the cart by its key", async () => {
    for (const key of ["addons.unavailable", "addons.required", "catalog.addons_disabled"]) {
      pay.startPayment.mockRejectedValueOnce(new StoreApiError(400, key, null))
      await expect(submit()).resolves.toMatchObject({ error: key })
    }
    expect(next.revalidatePath).not.toHaveBeenCalled()
  })

  it("says a wholesale cart priced again in the cart's own words (ADR-0068 slice 4)", async () => {
    pay.startPayment.mockRejectedValueOnce(new StoreApiError(409, "wholesale.prices_changed", null))
    await expect(submit()).resolves.toMatchObject({ error: "cart.prices_changed" })
    pay.completeCart.mockRejectedValueOnce(new StoreApiError(409, "wholesale.prices_changed", null))
    await expect(submit()).resolves.toMatchObject({ error: "cart.prices_changed" })
    expect(next.revalidatePath).toHaveBeenCalledTimes(2)
    expect(next.redirect).not.toHaveBeenCalled()
  })

  it("sends a wholesale order under its minimum to the cart, which says it (ADR-0068 §8)", async () => {
    pay.startPayment.mockRejectedValue(new StoreApiError(400, "wholesale.min_quantity", null))
    await expect(submit()).rejects.toThrow("redirect:/sepet")
    expect(pay.completeCart).not.toHaveBeenCalled()
  })

  it("sends a unit another order took to the cart, which names it (adr/0026 Ek 2026-11-06)", async () => {
    pay.startPayment.mockRejectedValue(new StoreApiError(400, "cart.out_of_stock", null))
    await expect(submit()).rejects.toThrow("redirect:/sepet?hata=cart.out_of_stock")
    expect(pay.completeCart).not.toHaveBeenCalled()
  })
})
