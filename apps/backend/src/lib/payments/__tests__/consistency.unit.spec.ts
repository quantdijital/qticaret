import { paidWithoutHostedForm, paymentMismatch } from "../consistency"

const session = (overrides: Record<string, unknown> = {}) => ({
  provider_id: "pp_paytr_paytr",
  status: "pending",
  raw_amount: "210",
  data: { amount: 21000 },
  ...overrides,
})
const cart = (sessions: ReturnType<typeof session>[], total = "210", collection = "210") => ({
  raw_total: total,
  payment_collection: { raw_amount: collection, payment_sessions: sessions },
})

describe("paymentMismatch (security review, 2026-10-27)", () => {
  it("passes a cart whose total, collection and sessions agree to the kuruş", () => {
    expect(paymentMismatch(cart([session()]))).toBe(false)
    expect(paymentMismatch({ raw_total: "0" })).toBe(false)
  })

  it("catches a session left at the old amount, in Medusa's column or the form's own record", () => {
    expect(paymentMismatch(cart([session({ raw_amount: "150" })]))).toBe(true)
    expect(paymentMismatch(cart([session({ data: { amount: 15000 } })]))).toBe(true)
    expect(paymentMismatch(cart([session()], "300"))).toBe(true)
  })

  it("ignores sessions that can no longer be paid", () => {
    expect(paymentMismatch(cart([session({ status: "canceled", raw_amount: "1" })]))).toBe(false)
  })
})

describe("paidWithoutHostedForm", () => {
  it("refuses a storefront completion paid with Medusa's system provider", () => {
    expect(paidWithoutHostedForm(cart([session({ provider_id: "pp_system_default" })]))).toBe(true)
    expect(paidWithoutHostedForm(cart([]))).toBe(true)
  })

  it("lets a hosted form's session, and a cart credit pays in full, through", () => {
    expect(paidWithoutHostedForm(cart([session()]))).toBe(false)
    expect(paidWithoutHostedForm(cart([], "0", "0"))).toBe(false)
    expect(paidWithoutHostedForm({ raw_total: "0" })).toBe(false)
  })
})
