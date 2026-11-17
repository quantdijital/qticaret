import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { settleFailedEntry } from "../refund-settle"
import { refundTraceOf } from "../refund-trace"
import type { TracedRefund } from "../refund-trace"

const queryStatus = jest.fn()
jest.mock("../../../lib/payments/paytr", () => ({
  paytrApi: () => ({ queryStatus }),
  paytrCredentialsOf: (stored: unknown) => stored,
}))
const alertPaymentIssue = jest.fn<Promise<void>, unknown[]>()
jest.mock("../../payments/issue-alert", () => ({
  alertPaymentIssue: (...args: unknown[]) => alertPaymentIssue(...args),
}))

const OID = "payses01JABCDEFGHJKMNPQRSTVWXYZ0"
const REFERENCE = "0123456789abcdef0123456789abcdef"
const paytrPayment = (data: Record<string, unknown> = {}) => ({
  id: "pay_01",
  provider_id: "pp_paytr_paytr",
  data: { merchant_oid: OID, ...data },
})
const madeData = { refunds: [{ reference_no: REFERENCE, amount: 1000 }] }

function containerWith(
  payment: unknown,
  options: { account?: unknown; entry?: Record<string, unknown> } = {}
) {
  const listPayments = jest.fn(() =>
    payment instanceof Error ? Promise.reject(payment) : Promise.resolve(payment ? [payment] : [])
  )
  const updateOrderRefunds = jest.fn()
  const entry = {
    id: "oref_01",
    order_id: "order_01",
    reference: REFERENCE,
    payment_id: "pay_01",
    amount: 1000,
    provider_parts: null,
    ...options.entry,
  }
  const container = createMedusaContainer()
  container.register({
    [Modules.PAYMENT]: asValue({ listPayments }),
    [INTEGRATION_CREDENTIALS_MODULE]: asValue({
      read: () => Promise.resolve("account" in options ? options.account : { merchantId: "1" }),
    }),
    [ORDER_REFUNDS_MODULE]: asValue({
      listOrderRefunds: () => Promise.resolve([entry]),
      updateOrderRefunds,
    }),
  })
  return { container, updateOrderRefunds }
}

const traced: TracedRefund = { reference: REFERENCE, payment_id: "pay_01", amount: 1000, parts: [] }
const traceIn = async (payment: unknown, entry: TracedRefund = traced) =>
  (await refundTraceOf(containerWith(payment).container, entry)).trace

beforeEach(() => {
  jest.resetAllMocks()
})

describe("an order refund's trace once a step after the provider failed (review 2026-11-17)", () => {
  it("is made when the payment's data records this amount under the reference", async () => {
    const { container } = containerWith(paytrPayment(madeData))

    expect(await refundTraceOf(container, traced)).toEqual({ trace: "made", provider: "paytr" })
    expect(queryStatus).not.toHaveBeenCalled()
    // Another amount under the reference is not this refund (review D5)
    queryStatus.mockResolvedValue({ refunds: [] })
    expect(await traceIn(paytrPayment(madeData), { ...traced, amount: 500 })).toBe("none")
  })

  it("is shown when PayTR lists this amount under the reference its answer never brought", async () => {
    queryStatus.mockResolvedValue({ refunds: [{ amount: 1000, referenceNo: REFERENCE }] })

    expect(await traceIn(paytrPayment())).toBe("shown")
    queryStatus.mockResolvedValue({ refunds: [{ amount: 500, referenceNo: REFERENCE }] })
    expect(await traceIn(paytrPayment())).toBe("none")
  })

  it("reads iyzico's parts: all answered for the whole is shown, anything less partial", async () => {
    const iyzico = { id: "pay_01", provider_id: "pp_iyzico_iyzico", data: {} }
    const done = { amount: 1000, state: "done" }

    expect(await traceIn(iyzico, { ...traced, parts: [done] })).toBe("shown")
    expect(await traceIn(iyzico, { ...traced, parts: [{ ...done, state: "sending" }] })).toBe(
      "partial"
    )
    expect(await traceIn(iyzico, { ...traced, parts: [{ ...done, amount: 400 }] })).toBe("partial")
  })

  it("is unknown when the payment or PayTR cannot be read, none when nothing shows", async () => {
    queryStatus.mockRejectedValue(new Error("connection reset"))
    expect(await traceIn(paytrPayment())).toBe("unknown")
    expect(await traceIn(new Error("database gone"))).toBe("unknown")

    queryStatus.mockResolvedValue({ refunds: [] })
    expect(await traceIn(paytrPayment())).toBe("none")
    const bank = { id: "pay_01", provider_id: "pp_bank-transfer_bank-transfer", data: {} }
    expect(await traceIn(bank)).toBe("none")
  })

  it("is unknown, never none, when PayTR cannot be asked or lists a refund it cannot name (D-2)", async () => {
    const unconfigured = containerWith(paytrPayment(), { account: null }).container
    expect((await refundTraceOf(unconfigured, traced)).trace).toBe("unknown")
    const noReference = { id: "pay_01", provider_id: "pp_paytr_paytr", data: {} }
    expect(await traceIn(noReference)).toBe("unknown")

    // A refund of this amount PayTR lists without a reference: ours always carry one
    queryStatus.mockResolvedValue({ refunds: [{ amount: 1000, referenceNo: null }] })
    expect(await traceIn(paytrPayment())).toBe("unknown")
    queryStatus.mockResolvedValue({ refunds: [{ amount: 400, referenceNo: null }] })
    expect(await traceIn(paytrPayment())).toBe("none")
  })
})

describe("a failed refund's ledger entry (review 2026-11-17, O2, D6)", () => {
  it("keeps a refund PayTR made pending as incomplete, and tells the shop", async () => {
    const { container, updateOrderRefunds } = containerWith(paytrPayment())
    queryStatus.mockResolvedValue({ refunds: [{ amount: 1000, referenceNo: REFERENCE }] })

    await settleFailedEntry(container, "oref_01")

    expect(updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "pending",
      error_code: "refund_incomplete",
    })
    expect(alertPaymentIssue).toHaveBeenCalledWith(container, {
      issue: "refund_incomplete",
      provider: "paytr",
      reference: REFERENCE,
      cart_id: "order_01",
      amount: 1000,
    })
  })

  it("keeps a refund PayTR shows nothing of yet unconfirmed, counted, with no alert", async () => {
    const { container, updateOrderRefunds } = containerWith(paytrPayment())
    queryStatus.mockResolvedValue({ refunds: [] })

    await settleFailedEntry(container, "oref_01")

    expect(updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "pending",
      error_code: "refund_unconfirmed",
    })
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })

  it.each([
    ["shows nothing", { refunds: [] }],
    ["cannot be read", new Error("connection reset")],
  ])("fails at once a refund PayTR refused outright and %s", async (_, answer) => {
    const { container, updateOrderRefunds } = containerWith(paytrPayment(), {
      entry: { error_code: "provider_refused" },
    })
    if (answer instanceof Error) {
      queryStatus.mockRejectedValue(answer)
    } else {
      queryStatus.mockResolvedValue(answer)
    }

    await settleFailedEntry(container, "oref_01")

    expect(updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "failed",
      error_code: "refund_failed",
    })
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })

  it("fails a refund nothing was sent for where nothing shown is proof", async () => {
    const iyzico = { id: "pay_01", provider_id: "pp_iyzico_iyzico", data: {} }
    const { container, updateOrderRefunds } = containerWith(iyzico)

    await settleFailedEntry(container, "oref_01")

    expect(updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "failed",
      error_code: "refund_failed",
    })
  })

  it("tells no shop to check a panel a transfer or cash refund has none of (D6)", async () => {
    const bank = { id: "pay_01", provider_id: "pp_bank-transfer_bank-transfer", data: madeData }
    const { container, updateOrderRefunds } = containerWith(bank)

    await settleFailedEntry(container, "oref_01")

    expect(updateOrderRefunds).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", error_code: "refund_incomplete" })
    )
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })
})
