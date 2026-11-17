import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { CONFIRM_MS, ESCALATE_MS, settleOpenRefunds } from "../settle-open-refunds"

const refundRun = jest.fn()
jest.mock("../refund-order", () => ({
  refundOrderWorkflow: () => ({ run: refundRun }),
}))
const refundTraceOf = jest.fn()
jest.mock("../refund-trace", () => ({
  refundTraceOf: (...args: unknown[]) => refundTraceOf(...args) as unknown,
}))
const alertPaymentIssue = jest.fn<Promise<void>, unknown[]>()
jest.mock("../../payments/issue-alert", () => ({
  alertPaymentIssue: (...args: unknown[]) => alertPaymentIssue(...args),
}))

const NOW = Date.parse("2026-11-17T12:00:00Z")
const ago = (ms: number) => new Date(NOW - ms)

const entryOf = (fields: Record<string, unknown> = {}) => ({
  id: "oref_01",
  order_id: "order_01",
  reference: "0123456789abcdef0123456789abcdef",
  payment_id: "pay_01",
  amount: 1000,
  provider_parts: null,
  error_code: "refund_incomplete",
  created_at: ago(10 * 60 * 1000),
  updated_at: ago(5 * 60 * 1000),
  ...fields,
})

function ledgerWith(entry: ReturnType<typeof entryOf>) {
  const updateOrderRefunds = jest.fn()
  // The round's list first, then the re-read under the lock
  const listOrderRefunds = jest
    .fn()
    .mockResolvedValueOnce([entry])
    .mockResolvedValue([{ id: entry.id }])
  const container = createMedusaContainer()
  container.register({
    [ORDER_REFUNDS_MODULE]: asValue({ listOrderRefunds, updateOrderRefunds }),
    [Modules.LOCKING]: asValue({
      execute: (_keys: unknown, job: () => Promise<unknown>) => job(),
    }),
  })
  return { container, updateOrderRefunds, listOrderRefunds }
}

const traceIs = (trace: string, provider = "paytr") =>
  refundTraceOf.mockResolvedValue({ trace, provider })

beforeEach(() => {
  jest.resetAllMocks()
})

describe("the settling job reads open refunds again and never sends one (review O1/O2)", () => {
  it.each(["made", "shown"])("closes a refund %s under its own reference", async (trace) => {
    const entry = entryOf()
    const { container, updateOrderRefunds } = ledgerWith(entry)
    traceIs(trace)

    expect(await settleOpenRefunds(container, NOW)).toEqual({ closed: 1, failed: 0, open: 0 })
    expect(refundRun).toHaveBeenCalledWith({
      input: {
        order_id: "order_01",
        reference: entry.reference,
        request: { amount: 1000 },
        payment_id: "pay_01",
      },
    })
    expect(updateOrderRefunds).not.toHaveBeenCalled()
  })

  it("marks a PayTR refund shown nothing as unconfirmed on the first read", async () => {
    const { container, updateOrderRefunds } = ledgerWith(entryOf())
    traceIs("none")

    expect(await settleOpenRefunds(container, NOW)).toEqual({ closed: 0, failed: 0, open: 1 })
    expect(updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "pending",
      error_code: "refund_unconfirmed",
    })
    expect(refundRun).not.toHaveBeenCalled()
  })

  it("fails it, its lines free again, once PayTR shows nothing again long after", async () => {
    const recent = ledgerWith(entryOf({ error_code: "refund_unconfirmed" }))
    traceIs("none")
    await settleOpenRefunds(recent.container, NOW)

    const old = ledgerWith(
      entryOf({ error_code: "refund_unconfirmed", updated_at: ago(CONFIRM_MS) })
    )
    expect(await settleOpenRefunds(old.container, NOW)).toEqual({ closed: 0, failed: 1, open: 0 })

    expect(recent.updateOrderRefunds).not.toHaveBeenCalled()
    expect(old.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "failed",
      error_code: "refund_failed",
    })
  })

  it("fails at once where nothing shown is proof (iyzico, nothing sent)", async () => {
    const { container, updateOrderRefunds } = ledgerWith(entryOf())
    traceIs("none", "iyzico")

    await settleOpenRefunds(container, NOW)

    expect(updateOrderRefunds).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error_code: "refund_failed" })
    )
  })

  it("leaves one it cannot read, and tells the shop once it is an hour old", async () => {
    const young = ledgerWith(entryOf())
    traceIs("unknown")
    await settleOpenRefunds(young.container, NOW)
    expect(alertPaymentIssue).not.toHaveBeenCalled()

    const old = ledgerWith(entryOf({ created_at: ago(ESCALATE_MS) }))
    expect(await settleOpenRefunds(old.container, NOW)).toEqual({ closed: 0, failed: 0, open: 1 })

    expect(old.updateOrderRefunds).not.toHaveBeenCalled()
    expect(alertPaymentIssue).toHaveBeenCalledWith(old.container, {
      issue: "refund_unresolved",
      provider: "paytr",
      reference: "0123456789abcdef0123456789abcdef",
      cart_id: "order_01",
      amount: 1000,
    })
  })

  it("leaves an entry changed meanwhile (a retry under way) as it is", async () => {
    const { container, updateOrderRefunds, listOrderRefunds } = ledgerWith(entryOf())
    listOrderRefunds.mockReset().mockResolvedValueOnce([entryOf()]).mockResolvedValue([])
    traceIs("none")

    await settleOpenRefunds(container, NOW)

    expect(updateOrderRefunds).not.toHaveBeenCalled()
  })
})
