import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as Pay from "@/lib/checkout/pay"

const state = vi.hoisted(() => ({
  cartId: null as string | null,
  outcome: vi.fn(),
  forgetCart: vi.fn(),
  forgetFrame: vi.fn(),
}))
vi.mock("@/lib/cart/cookie", () => ({
  cartIdFromCookie: () => Promise.resolve(state.cartId),
  forgetCart: state.forgetCart,
}))
vi.mock("@/lib/checkout/payment-cookie", () => ({ forgetPaymentFrame: state.forgetFrame }))
vi.mock("@/lib/checkout/pay", async (actual) => ({
  ...(await actual<typeof Pay>()),
  paymentOutcome: state.outcome,
}))
vi.mock("@/lib/checkout/return", () => ({
  framed: () => false,
  breakOut: () => new Response("frame"),
  seeOther: (path: string) => new Response(null, { status: 303, headers: { location: path } }),
}))

const { GET } = await import("../route")

const back = async (query = "") => {
  const answer = await GET(new Request(`https://magaza.example/odeme/sonuc${query}`))
  return answer.headers.get("location")
}

/** adr/0026 Ek 2026-11-06: where a card payment comes back, and what it says. */
describe("/odeme/sonuc", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.cartId = "cart_1"
  })

  it("opens the order once the cart became one, and forgets the cart", async () => {
    state.outcome.mockResolvedValue({ state: "ordered", id: "order_1", token: "k" })

    expect(await back("?deneme=4")).toBe("/siparis/order_1?token=k&yeni=1")
    expect(state.forgetCart).toHaveBeenCalled()
    expect(state.forgetFrame).toHaveBeenCalled()
  })

  it("says a payment being given back at once, keeping the cart", async () => {
    state.outcome.mockResolvedValue({ state: "refund" })

    expect(await back("?deneme=1")).toBe("/odeme/durum?d=iade")
    expect(state.forgetCart).not.toHaveBeenCalled()
  })

  it("looks again while nothing is known, and stops after the last look", async () => {
    state.outcome.mockResolvedValue({ state: "pending" })

    expect(await back()).toBe("/odeme/durum?d=bekliyor&deneme=1")
    expect(await back("?deneme=5")).toBe("/odeme/durum?d=bekliyor&deneme=6")
    expect(await back("?deneme=14")).toBe("/odeme/durum?d=gecikti")
    expect(await back("?deneme=99999")).toBe("/odeme/durum?d=gecikti")
  })

  it("says the order comes by e-mail without a cart to look for", async () => {
    state.cartId = null

    expect(await back()).toBe("/odeme/durum?d=gecikti")
    expect(state.outcome).not.toHaveBeenCalled()
  })
})
