import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import { cancelRefundReference, isCancelRefundReference } from "../../../lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { refundForCancel } from "../cancel-refunds"
import { referenceTaken } from "../steps/order-refund-guard"

const refundRun = jest.fn()
jest.mock("../refund-order", () => ({
  refundOrderWorkflow: () => ({ run: refundRun }),
}))
const refundTraceOf = jest.fn()
jest.mock("../refund-trace", () => ({
  refundTraceOf: (...args: unknown[]) => refundTraceOf(...args) as unknown,
}))
const readOrderMoney = jest.fn()
jest.mock("../order-money", () => ({
  readOrderMoney: (...args: unknown[]) => readOrderMoney(...args) as unknown,
}))
const paymentRemainders = jest.fn()
jest.mock("../steps/order-refund", () => ({
  paymentRemainders: (...args: unknown[]) => paymentRemainders(...args) as unknown,
}))

const input = { order_id: "order_01", note: "order canceled", created_by: "user_01" }

function ledgerWith(open: Record<string, unknown>[]) {
  const container = createMedusaContainer()
  container.register({
    [ORDER_REFUNDS_MODULE]: asValue({ listOrderRefunds: () => Promise.resolve(open) }),
  })
  return container
}

const references = () =>
  refundRun.mock.calls.map(
    ([call]) =>
      (call as { input: { reference: string; payment_id: string; request: unknown } }).input
  )

beforeEach(() => {
  jest.resetAllMocks()
})

describe("a cancel refunds each payment once, under the payment's own reference (review Y1)", () => {
  it("names a cancel's refund after its payment, never after its place in a list", () => {
    expect(cancelRefundReference("pay_01JABCDEFGHJKMNPQRSTVWXYZ0")).toBe(
      "cancelpay01JABCDEFGHJKMNPQRSTVWXYZ0"
    )
    expect(cancelRefundReference(`pay_${"X".repeat(60)}`)).toHaveLength(40)
    expect(isCancelRefundReference("cancelorder01")).toBe(true)
    expect(isCancelRefundReference("0123456789abcdef0123456789abcdef")).toBe(false)
  })

  it("refuses a reference made before for another payment, or another order", () => {
    const made = { order_id: "order_01", payment_id: "pay_P0" }

    expect(referenceTaken(made, { order_id: "order_01", payment_id: "pay_P1" })).toBe(true)
    expect(referenceTaken(made, { order_id: "order_02" })).toBe(true)
    expect(referenceTaken(made, { order_id: "order_01", payment_id: "pay_P0" })).toBe(false)
    // The panel names no payment: the reference is its own key
    expect(referenceTaken(made, { order_id: "order_01" })).toBe(false)
  })

  it("settles the first payment a cancel left open, then refunds the second under its own", async () => {
    // The first try refunded P0 (an older cancel's order-named reference), then a step failed
    const container = ledgerWith([
      { reference: "cancelorder01", payment_id: "pay_P0", amount: 33000, provider_parts: null },
    ])
    // Settled, P0 has nothing left; P1, the edit's difference, has all of it
    readOrderMoney.mockResolvedValue({ refundable: 12000 })
    paymentRemainders.mockResolvedValue([
      { id: "pay_P0", remaining: 0 },
      { id: "pay_P1", remaining: 12000 },
    ])

    expect(await refundForCancel(container as never, input)).toBe(1)

    expect(references()).toEqual([
      expect.objectContaining({ reference: "cancelorder01", payment_id: "pay_P0" }),
      expect.objectContaining({
        reference: cancelRefundReference("pay_P1"),
        payment_id: "pay_P1",
        request: { amount: 12000 },
      }),
    ])
    // A cancel's own open refund is tried again as it is, not judged
    expect(refundTraceOf).not.toHaveBeenCalled()
  })

  it("closes another open refund whose money is surely back, and waits for one that is not", async () => {
    const panel = {
      reference: "0123456789abcdef0123456789abcdef",
      payment_id: "pay_P0",
      amount: 5000,
      provider_parts: null,
    }
    readOrderMoney.mockResolvedValue({ refundable: 0 })
    paymentRemainders.mockResolvedValue([])
    refundTraceOf.mockResolvedValue({ trace: "made", provider: "paytr" })

    await refundForCancel(ledgerWith([panel]) as never, input)
    expect(references()).toEqual([expect.objectContaining({ reference: panel.reference })])

    refundRun.mockClear()
    for (const trace of ["none", "unknown", "partial"]) {
      refundTraceOf.mockResolvedValue({ trace, provider: "paytr" })
      await expect(refundForCancel(ledgerWith([panel]) as never, input)).rejects.toMatchObject({
        safeMessage: "orders.refund_unsettled",
      })
    }
    expect(refundRun).not.toHaveBeenCalled()
  })

  it("refunds each payment with money left, a hosted form's first, up to what is refundable", async () => {
    readOrderMoney.mockResolvedValue({ refundable: 40000 })
    paymentRemainders.mockResolvedValue([
      { id: "pay_P0", remaining: 33000 },
      { id: "pay_P1", remaining: 12000 },
    ])

    expect(await refundForCancel(ledgerWith([]) as never, input)).toBe(2)
    expect(references().map(({ payment_id, request }) => [payment_id, request])).toEqual([
      ["pay_P0", { amount: 33000 }],
      ["pay_P1", { amount: 7000 }],
    ])
  })
})
