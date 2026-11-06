import { beforeEach, describe, expect, it, vi } from "vitest"

// The browser's cookie jar, as the frame page reads it and the pay action writes it
const jar = vi.hoisted(() => new Map<string, string>())
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    }),
}))
vi.mock("../../security/cookies", () => ({
  cookieName: (base: string) => base,
  setOwnCookie: (name: string, value: string) => {
    jar.set(name, value)
    return Promise.resolve()
  },
  clearOwnCookie: (name: string) => {
    jar.delete(name)
    return Promise.resolve()
  },
}))
vi.mock("../../env", () => ({
  storefrontEnv: () => ({}),
  paymentFrameOrigins: () => ["https://www.paytr.com"],
}))
vi.mock("../../store-api/server", () => ({
  storeCall: vi.fn(),
  storeGet: vi.fn(),
  storePost: vi.fn(),
}))

const { paymentFrame, rememberPaymentFrame } = await import("../payment-cookie")
const { sessionMatches } = await import("../pay")

const CART = "cart_01JCHECKOUT00"
const SESSION = "payses_01JSESSION0001"
const FORM = "https://www.paytr.com/odeme/guvenli/abc|def"

/**
 * The card form is framed only for the session it charges, and only while
 * that session charges the cart's total now (D7, adr/0026): a code applied
 * or taken off after the form was made sends the shopper to start anew.
 */
describe("the card form's cookie", () => {
  beforeEach(() => {
    jar.clear()
  })

  it("keeps the form with its cart and session, and gives both back", async () => {
    await expect(rememberPaymentFrame(CART, SESSION, FORM)).resolves.toBe(true)
    await expect(paymentFrame(CART)).resolves.toEqual({
      url: new URL(FORM).href,
      session: SESSION,
    })
  })

  it("frames nothing for another cart, an origin not allowed or a form with no session", async () => {
    await rememberPaymentFrame(CART, SESSION, FORM)
    await expect(paymentFrame("cart_01JSOMEONEELSE")).resolves.toBeNull()
    await expect(rememberPaymentFrame(CART, SESSION, "https://kotu.example/form")).resolves.toBe(
      false
    )
    await expect(rememberPaymentFrame(CART, "", FORM)).resolves.toBe(false)
    // A cookie from before the session was kept in it
    jar.set("qt_pay", `${CART}|${FORM}`)
    await expect(paymentFrame(CART)).resolves.toBeNull()
  })
})

describe("sessionMatches", () => {
  const cart = (total: number, sessions: { id: string; amount: number | string }[] | null) => ({
    total,
    payment_collection: { payment_sessions: sessions },
  })

  it("holds while the form's session is the cart's, for the cart's total", () => {
    expect(sessionMatches(cart(1335.5, [{ id: SESSION, amount: 1335.5 }]), SESSION)).toBe(true)
    expect(sessionMatches(cart(1335.5, [{ id: SESSION, amount: "1335.50" }]), SESSION)).toBe(true)
  })

  it("fails once a code changed the total the session was made for", () => {
    expect(sessionMatches(cart(1201.95, [{ id: SESSION, amount: 1335.5 }]), SESSION)).toBe(false)
  })

  it("fails once the cart's change dropped the session, or there is no collection", () => {
    expect(
      sessionMatches(cart(1335.5, [{ id: "payses_01JNEWERSESSION", amount: 1335.5 }]), SESSION)
    ).toBe(false)
    expect(sessionMatches(cart(1335.5, null), SESSION)).toBe(false)
    expect(sessionMatches({ total: 1335.5, payment_collection: null }, SESSION)).toBe(false)
  })
})
