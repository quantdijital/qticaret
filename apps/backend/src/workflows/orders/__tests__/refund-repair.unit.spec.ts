import { asValue } from "@medusajs/framework/awilix"
import {
  ContainerRegistrationKeys,
  Modules,
  createMedusaContainer,
} from "@medusajs/framework/utils"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { checkedNote } from "../made-refund-record"
import { settleRefundByHand } from "../settle-refund-by-hand"
import { closeRefundEntry } from "../steps/order-refund"
import { restoreRefundTransaction } from "../steps/refund-transactions"

const refundTraceOf = jest.fn()
jest.mock("../refund-trace", () => ({
  refundTraceOf: (...args: unknown[]) => refundTraceOf(...args) as unknown,
}))

const REFERENCE = "0123456789abcdef0123456789abcdef"
const entry = { order_id: "order_01", payment_id: "pay_01", reference: REFERENCE, amount: 1000 }
const raw = (lira: number) => ({ value: String(lira), precision: 20 })

interface Setup {
  data?: Record<string, unknown>
  captured?: number
  refunds?: { id: string; note?: string; raw_amount: ReturnType<typeof raw> }[]
  transactions?: { id: string }[]
  ledger?: Record<string, unknown>[]
}

function containerWith(options: Setup) {
  const addOrderTransactions = jest.fn()
  const listOrderTransactions = jest.fn(() => Promise.resolve(options.transactions ?? []))
  const createRefunds = jest.fn(() => Promise.resolve({ id: "ref_NEW" }))
  const updatePayment = jest.fn()
  const updatePaymentCollections = jest.fn()
  const updateOrderRefunds = jest.fn()
  const saveProviderParts = jest.fn()
  const payment = {
    id: "pay_01",
    currency_code: "try",
    payment_collection_id: "paycol_01",
    data: options.data ?? {},
    captures: [{ raw_amount: raw(options.captured ?? 330) }],
    refunds: options.refunds ?? [],
  }
  const container = createMedusaContainer()
  container.register({
    [ContainerRegistrationKeys.QUERY]: asValue({
      graph: ({ entity }: { entity: string }) =>
        Promise.resolve({ data: [entity === "payment" ? payment : { payments: [payment] }] }),
    }),
    [Modules.ORDER]: asValue({ listOrderTransactions, addOrderTransactions }),
    [Modules.PAYMENT]: asValue({
      listPayments: () => Promise.resolve([payment]),
      createRefunds,
      updatePayment,
      updatePaymentCollections,
    }),
    [ORDER_REFUNDS_MODULE]: asValue({
      listOrderRefunds: () => Promise.resolve(options.ledger ?? []),
      updateOrderRefunds,
      saveProviderParts,
    }),
  })
  return {
    container,
    addOrderTransactions,
    listOrderTransactions,
    createRefunds,
    updatePayment,
    updatePaymentCollections,
    updateOrderRefunds,
    saveProviderParts,
  }
}

const recorded = (refundId?: string) => ({
  refunds: [
    { reference_no: REFERENCE, amount: 1000, ...(refundId ? { refund_id: refundId } : {}) },
  ],
})

beforeEach(() => {
  jest.resetAllMocks()
  refundTraceOf.mockResolvedValue({ trace: "none", provider: "paytr" })
})

describe("a made refund's order money move is mended for its own refund alone (D1, D-3)", () => {
  it("writes the move of the refund the payment's data names, when there is none", async () => {
    const shop = containerWith({
      data: recorded("ref_01"),
      refunds: [
        { id: "ref_00", raw_amount: raw(10) },
        { id: "ref_01", raw_amount: raw(10) },
      ],
    })

    expect(await restoreRefundTransaction(shop.container, entry)).toBe(1)
    // Looked for by the refund's id alone, whatever its reference (Medusa's cancel writes the payment's)
    expect(shop.listOrderTransactions).toHaveBeenCalledWith(
      { order_id: "order_01", reference_id: "ref_01" },
      expect.anything()
    )
    expect(shop.addOrderTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "order_01", reference: "refund", reference_id: "ref_01" })
    )
  })

  it("writes nothing when the move is there, or no refund is named", async () => {
    const there = containerWith({
      data: recorded("ref_01"),
      refunds: [{ id: "ref_01", raw_amount: raw(10) }],
      transactions: [{ id: "ordtrx_01" }],
    })
    const unnamed = containerWith({
      data: recorded(),
      refunds: [{ id: "ref_01", raw_amount: raw(10) }],
    })

    expect(await restoreRefundTransaction(there.container, entry)).toBe(0)
    expect(await restoreRefundTransaction(unnamed.container, entry)).toBe(0)
    expect(there.addOrderTransactions).not.toHaveBeenCalled()
    expect(unnamed.addOrderTransactions).not.toHaveBeenCalled()
  })
})

describe("staff settle an open refund they checked at the provider (O2), sending nothing", () => {
  const open = { id: "oref_01", status: "pending", provider_parts: null, ...entry }
  const input = { order_id: "order_01", reference: REFERENCE, actor_id: "user_01" }

  it("closes it as made, with Medusa's refund record and the collection's refunded total", async () => {
    const shop = containerWith({ ledger: [open] })

    expect(await settleRefundByHand(shop.container, { ...input, outcome: "made" })).toEqual({
      reference: REFERENCE,
      status: "done",
    })
    expect(shop.createRefunds).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: "pay_01",
        created_by: "user_01",
        note: checkedNote(REFERENCE),
      })
    )
    expect(shop.updatePayment).toHaveBeenCalledWith({
      id: "pay_01",
      data: { refunds: [{ reference_no: REFERENCE, amount: 1000, refund_id: "ref_NEW" }] },
    })
    expect(shop.updatePaymentCollections).toHaveBeenCalledWith("paycol_01", expect.anything())
    expect(shop.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "done",
      error_code: "checked_made",
    })
  })

  it("writes no second Medusa refund: one recorded, or an earlier try's by its note (D-2)", async () => {
    const kept = containerWith({ ledger: [open], data: recorded("ref_01") })
    const tried = containerWith({
      ledger: [open],
      refunds: [{ id: "ref_TRY", note: checkedNote(REFERENCE), raw_amount: raw(10) }],
    })

    await settleRefundByHand(kept.container, { ...input, outcome: "made" })
    await settleRefundByHand(tried.container, { ...input, outcome: "made" })

    expect(kept.createRefunds).not.toHaveBeenCalled()
    expect(tried.createRefunds).not.toHaveBeenCalled()
    expect(tried.updatePayment).toHaveBeenCalledWith({
      id: "pay_01",
      data: { refunds: [{ reference_no: REFERENCE, amount: 1000, refund_id: "ref_TRY" }] },
    })
  })

  it("refuses a made refund past what the payment can still give back (D-2)", async () => {
    const shop = containerWith({
      ledger: [open],
      captured: 330,
      refunds: [{ id: "ref_00", raw_amount: raw(325) }],
    })

    await expect(
      settleRefundByHand(shop.container, { ...input, outcome: "made" })
    ).rejects.toMatchObject({
      safeMessage: "orders.refund_exceeds_paid",
    })
    expect(shop.createRefunds).not.toHaveBeenCalled()
    expect(shop.updateOrderRefunds).not.toHaveBeenCalled()
  })

  it("fails it as not made, its lines free again, and touches no money record", async () => {
    const shop = containerWith({ ledger: [open] })

    expect(await settleRefundByHand(shop.container, { ...input, outcome: "not_made" })).toEqual({
      reference: REFERENCE,
      status: "failed",
    })
    expect(shop.createRefunds).not.toHaveBeenCalled()
    expect(shop.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "failed",
      error_code: "checked_not_made",
    })
  })

  it.each(["made", "shown"])(
    "refuses not made for money the trace shows %s (D-1)",
    async (trace) => {
      refundTraceOf.mockResolvedValue({ trace, provider: "paytr" })
      const shop = containerWith({ ledger: [open] })

      await expect(
        settleRefundByHand(shop.container, { ...input, outcome: "not_made" })
      ).rejects.toMatchObject({ safeMessage: "orders.refund_check_shown" })
      expect(shop.updateOrderRefunds).not.toHaveBeenCalled()
    }
  )

  it("marks done a part left sending when a made or shown refund is closed (O4-1)", async () => {
    const sending = { transaction_id: "t1", amount: 1000, state: "sending" }
    const shop = containerWith({ ledger: [{ ...open, provider_parts: [sending] }] })

    await closeRefundEntry(shop.container, "oref_01", "pay_01")

    expect(shop.saveProviderParts).toHaveBeenCalledWith(REFERENCE, [{ ...sending, state: "done" }])
    expect(shop.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "done",
      error_code: null,
    })
  })

  it("writes the parts first and the entry last: cut short, the job finds it shown (O4-1, D4-4)", async () => {
    const sending = { transaction_id: "t1", amount: 1000, state: "sending" }
    const shop = containerWith({
      ledger: [{ ...open, provider_parts: [sending] }],
      data: { pending_refund: { reference_no: REFERENCE, amount: 1000 } },
    })

    await settleRefundByHand(shop.container, { ...input, outcome: "made" })

    const order = (mock: jest.Mock) => mock.mock.invocationCallOrder[0] ?? 0
    expect(order(shop.saveProviderParts)).toBeLessThan(order(shop.createRefunds))
    // The refund's name off (null: Medusa merges the data) before the entry is closed
    expect(shop.updatePayment).toHaveBeenCalledWith({
      id: "pay_01",
      data: { pending_refund: null },
    })
    const nameOff = shop.updatePayment.mock.invocationCallOrder.at(-1) ?? 0
    expect(nameOff).toBeLessThan(order(shop.updateOrderRefunds))
  })

  it("settles iyzico's parts whose answer was lost, and refuses a refund made in part (O-2)", async () => {
    const sending = { transaction_id: "t1", amount: 1000, state: "sending" }
    const lost = containerWith({ ledger: [{ ...open, provider_parts: [sending] }] })
    const lostAgain = containerWith({ ledger: [{ ...open, provider_parts: [sending] }] })
    const half = [
      { transaction_id: "t1", amount: 400, state: "done" },
      { transaction_id: "t2", amount: 300, state: "sending" },
    ]
    const inPart = containerWith({ ledger: [{ ...open, provider_parts: half }] })

    await settleRefundByHand(lost.container, { ...input, outcome: "made" })
    await settleRefundByHand(lostAgain.container, { ...input, outcome: "not_made" })

    expect(lost.saveProviderParts).toHaveBeenCalledWith(REFERENCE, [{ ...sending, state: "done" }])
    expect(lostAgain.saveProviderParts).toHaveBeenCalledWith(REFERENCE, [])
    for (const outcome of ["made", "not_made"] as const) {
      await expect(
        settleRefundByHand(inPart.container, { ...input, outcome })
      ).rejects.toMatchObject({ safeMessage: "orders.refund_check_partial" })
    }
    expect(inPart.saveProviderParts).not.toHaveBeenCalled()
  })

  it("refuses a refund not open, or another order's", async () => {
    const closed = containerWith({ ledger: [{ ...open, status: "done" }] })
    const other = containerWith({ ledger: [{ ...open, order_id: "order_02" }] })

    await expect(
      settleRefundByHand(closed.container, { ...input, outcome: "made" })
    ).rejects.toMatchObject({ safeMessage: "orders.refund_not_open" })
    await expect(
      settleRefundByHand(other.container, { ...input, outcome: "made" })
    ).rejects.toMatchObject({ message: "orders.refund_unknown" })
    expect(closed.updateOrderRefunds).not.toHaveBeenCalled()
  })
})
