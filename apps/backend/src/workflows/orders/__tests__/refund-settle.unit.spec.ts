import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { refundMade, refundTraceOf } from "../refund-trace"
import { settleFailedEntry } from "../steps/order-refund"

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
const REFERENCE = "refund-0000-0000-01"
const SENT_AS = "refund0000000001"
const paytrPayment = (data: Record<string, unknown> = {}) => ({
  id: "pay_01",
  provider_id: "pp_paytr_paytr",
  data: { merchant_oid: OID, ...data },
})

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

const traced = { reference: REFERENCE, payment_id: "pay_01", parts: 0 }

beforeEach(() => {
  jest.resetAllMocks()
})

describe("an order refund's trace once a step after the provider failed (review 2026-11-17)", () => {
  it("is made when the payment's data records it: provider and Medusa both did", async () => {
    const { container } = containerWith(
      paytrPayment({ refunds: [{ reference_no: SENT_AS, amount: 1000 }] })
    )

    expect(await refundTraceOf(container, traced)).toEqual({ trace: "made", provider: "paytr" })
    expect(await refundMade(container, traced)).toBe(true)
    expect(queryStatus).not.toHaveBeenCalled()
  })

  it("is sent when PayTR shows a refund under the reference its answer never brought back", async () => {
    const { container } = containerWith(paytrPayment())
    queryStatus.mockResolvedValue({ refunds: [{ amount: 1000, referenceNo: SENT_AS }] })

    expect(await refundTraceOf(container, traced)).toEqual({ trace: "sent", provider: "paytr" })
    expect(queryStatus).toHaveBeenCalledWith({ merchantId: "1" }, OID)
    expect(await refundMade(container, traced)).toBe(false)
  })

  it("is none when PayTR shows no such refund, or the provider could not have sent it", async () => {
    queryStatus.mockResolvedValue({ refunds: [{ amount: 1000, referenceNo: "otherref" }] })

    expect((await refundTraceOf(containerWith(paytrPayment()).container, traced)).trace).toBe(
      "none"
    )
    // No account: PayTR's provider refused before sending (not_configured)
    const unconfigured = containerWith(paytrPayment(), { account: null }).container
    expect((await refundTraceOf(unconfigured, traced)).trace).toBe("none")
    const bank = { id: "pay_01", provider_id: "pp_bank-transfer_bank-transfer", data: {} }
    expect(await refundTraceOf(containerWith(bank).container, traced)).toEqual({
      trace: "none",
      provider: "bank-transfer",
    })
  })

  it("is sent for a part iyzico sent, and whenever nothing can be read: fails closed", async () => {
    const iyzico = { id: "pay_01", provider_id: "pp_iyzico_iyzico", data: {} }
    expect(
      (await refundTraceOf(containerWith(iyzico).container, { ...traced, parts: 1 })).trace
    ).toBe("sent")

    queryStatus.mockRejectedValue(new Error("connection reset"))
    expect((await refundTraceOf(containerWith(paytrPayment()).container, traced)).trace).toBe(
      "sent"
    )
    const unread = containerWith(new Error("database gone")).container
    expect((await refundTraceOf(unread, traced)).trace).toBe("sent")
  })
})

describe("a failed refund's ledger entry keeps money that left counted (review 2026-11-17)", () => {
  it("keeps a refund PayTR made pending as incomplete, and tells the shop", async () => {
    const { container, updateOrderRefunds } = containerWith(paytrPayment())
    queryStatus.mockResolvedValue({ refunds: [{ amount: 1000, referenceNo: SENT_AS }] })

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

  it("fails a refund surely not sent, as before, with no alert", async () => {
    const { container, updateOrderRefunds } = containerWith(paytrPayment())
    queryStatus.mockResolvedValue({ refunds: [] })

    await settleFailedEntry(container, "oref_01")

    expect(updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "failed",
      error_code: "refund_failed",
    })
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })
})
