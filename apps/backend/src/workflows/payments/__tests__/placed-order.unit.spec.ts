import { holdsSession, paytrSessionIdOf, placedOrderOf } from "../placed-order"
import { orderCheckOf, sessionOfRecovery } from "../recovery-order"
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

describe("orderCheckOf (finding 2026-11-16, security review round 1)", () => {
  const orphan = (reason: "session_gone" | "amount_mismatch" | "completion_failed") => ({
    provider: "paytr",
    reference: MERCHANT_OID,
    reason,
    cart_id: "cart_01",
  })

  it("stops any orphan whose payment the order holds, by session or by reference", () => {
    expect(orderCheckOf(orphan("completion_failed"), placed([SESSION]))).toEqual({
      kind: "held",
      order_id: "order_01",
    })
    expect(orderCheckOf(orphan("amount_mismatch"), placed([SESSION]))).toEqual({
      kind: "held",
      order_id: "order_01",
    })
    expect(
      orderCheckOf(
        { provider: "iyzico", reference: "27000001", reason: "completion_failed", cart_id: "c" },
        placed([OTHER], ["27000001"])
      )
    ).toEqual({ kind: "held", order_id: "order_01" })
  })

  it("leaves a 'could not complete' payment beside an order paid otherwise to the shop", () => {
    expect(orderCheckOf(orphan("completion_failed"), placed([OTHER], ["payses01OTHER"]))).toEqual({
      kind: "beside",
      order_id: "order_01",
    })
  })

  it("waits on a cart marked completed whose order cannot be read", () => {
    expect(orderCheckOf(orphan("completion_failed"), { ...placed([]), order_id: null })).toEqual({
      kind: "unread",
    })
  })

  it("lets a replaced or mismatched payment beside an order paid otherwise go back", () => {
    expect(orderCheckOf(orphan("amount_mismatch"), placed([OTHER], ["payses01OTHER"]))).toBeNull()
    expect(orderCheckOf(orphan("session_gone"), placed([OTHER]))).toBeNull()
    expect(orderCheckOf(orphan("completion_failed"), null)).toBeNull()
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
