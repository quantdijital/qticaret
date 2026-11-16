import { holdsSession, paytrSessionIdOf, placedOrderOf } from "../placed-order"
import { orderStopsRefund, sessionOfRecovery } from "../recovery-order"
import { answeredBefore } from "../steps/iyzico-callback"
import type { IyzicoTarget } from "../steps/iyzico-callback"

const SESSION = "payses_01JABCDEFGHJKMNPQRSTVWXYZ0"
const OTHER = "payses_01JZZZZZZZZZZZZZZZZZZZZZZ0"
const MERCHANT_OID = "payses01JABCDEFGHJKMNPQRSTVWXYZ0"

const placed = (sessions: string[], references: string[] = []) => ({
  order_id: "order_01",
  session_ids: sessions,
  references,
})

describe("placedOrderOf (finding 2026-11-16)", () => {
  it("reads no order for a cart neither ordered nor completed", () => {
    expect(placedOrderOf(undefined)).toBeNull()
    expect(placedOrderOf({ completed_at: null, order: null })).toBeNull()
  })

  it("reads the order with the sessions and references of its payments", () => {
    expect(
      placedOrderOf({
        completed_at: "2026-11-16T10:00:00Z",
        order: { id: "order_01" },
        payment_collection: {
          payments: [
            { payment_session_id: SESSION, data: { merchant_oid: MERCHANT_OID } },
            { payment_session_id: OTHER, data: { payment_id: "27000001" } },
            null,
          ],
        },
      })
    ).toEqual({
      order_id: "order_01",
      session_ids: [SESSION, OTHER],
      references: [MERCHANT_OID, "27000001"],
    })
  })

  it("never reads a completed cart whose order is not linked as no order", () => {
    expect(placedOrderOf({ completed_at: new Date(), order: null })).toEqual({
      order_id: null,
      session_ids: [],
      references: [],
    })
  })
})

describe("holdsSession (review N2)", () => {
  it("is the order's when the order's payment came from the notice's session", () => {
    expect(holdsSession(placed([SESSION]), SESSION)).toBe(true)
  })

  it("is not the order's when the notice's session paid nothing the order holds", () => {
    expect(holdsSession(placed([SESSION]), OTHER)).toBe(false)
    expect(holdsSession(placed([]), OTHER)).toBe(false)
  })

  it("takes a notice that names no session as the order's own", () => {
    expect(holdsSession(placed([SESSION]), undefined)).toBe(true)
  })
})

describe("paytrSessionIdOf", () => {
  it("reads our session from PayTR's reference, and nothing from another", () => {
    expect(paytrSessionIdOf(MERCHANT_OID)).toBe(SESSION)
    expect(paytrSessionIdOf("ORDER12345")).toBeNull()
    expect(paytrSessionIdOf("payses_01JABCDEFGHJKMNPQRSTVWXYZ0")).toBeNull()
  })

  it("is how the recovery job finds a PayTR orphan's session; iyzico's names none", () => {
    expect(sessionOfRecovery({ provider: "paytr", reference: MERCHANT_OID })).toBe(SESSION)
    expect(sessionOfRecovery({ provider: "iyzico", reference: "27000001" })).toBeNull()
  })
})

describe("orderStopsRefund (finding 2026-11-16)", () => {
  const orphan = (reason: "session_gone" | "amount_mismatch" | "completion_failed") => ({
    provider: "paytr",
    reference: MERCHANT_OID,
    reason,
    cart_id: "cart_01",
  })

  it("stops a cart that 'could not complete' yet is an order, whichever payment it holds", () => {
    expect(orderStopsRefund(orphan("completion_failed"), placed([SESSION]))).toBe(true)
    expect(orderStopsRefund(orphan("completion_failed"), placed([OTHER]))).toBe(true)
    expect(orderStopsRefund(orphan("completion_failed"), { ...placed([]), order_id: null })).toBe(
      true
    )
  })

  it("stops any orphan whose payment the order holds, by session or by reference", () => {
    expect(orderStopsRefund(orphan("amount_mismatch"), placed([SESSION]))).toBe(true)
    expect(
      orderStopsRefund(
        { provider: "iyzico", reference: "27000001", reason: "amount_mismatch", cart_id: "c" },
        placed([OTHER], ["27000001"])
      )
    ).toBe(true)
  })

  it("lets a payment beside an order paid otherwise go back", () => {
    expect(orderStopsRefund(orphan("amount_mismatch"), placed([OTHER], ["payses01OTHER"]))).toBe(
      false
    )
    expect(orderStopsRefund(orphan("session_gone"), placed([OTHER]))).toBe(false)
  })
})

describe("answeredBefore: a re-posted iyzico callback (finding 2026-11-16)", () => {
  const target: IyzicoTarget = {
    session_id: SESSION,
    token: "token-1",
    cart_id: "cart_01",
    orphan: false,
    expected: { amount: 21000, currency_code: "try", test_mode: true },
    return_urls: { success: "https://shop.example/ok", failure: "https://shop.example/no" },
  }

  it("answers a form the order already holds as paid, with its order, completing nothing", () => {
    expect(answeredBefore(target, placed([SESSION]))).toEqual({
      outcome: "paid",
      verdict: { kind: "skip" },
      payment_id: null,
      order_id: "order_01",
    })
  })

  it("asks iyzico as before for a cart not yet an order, or an order paid by another form", () => {
    expect(answeredBefore(target, null)).toBeNull()
    expect(answeredBefore(target, placed([OTHER]))).toBeNull()
    expect(answeredBefore(target, { ...placed([SESSION]), order_id: null })).toBeNull()
  })

  it("never answers for a session that is gone", () => {
    expect(
      answeredBefore({ session_id: SESSION, token: "t", cart_id: null, orphan: true }, placed([]))
    ).toBeNull()
  })
})
