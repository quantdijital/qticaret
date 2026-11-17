import { asValue } from "@medusajs/framework/awilix"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  createMedusaContainer,
} from "@medusajs/framework/utils"
import { ProviderError, ValidationError } from "../../../lib/errors"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { settleRefundByHand } from "../settle-refund-by-hand"
import { restoreRefundTransaction } from "../steps/refund-transactions"
import { refusedOutright } from "../steps/send-refund"

const REFERENCE = "0123456789abcdef0123456789abcdef"
const entry = { order_id: "order_01", payment_id: "pay_01", reference: REFERENCE, amount: 1000 }

function containerWith(options: {
  data?: Record<string, unknown>
  refunds?: { id: string; raw_amount: { value: string; precision: number } }[]
  transactions?: { id: string }[]
  ledger?: Record<string, unknown>[]
}) {
  const addOrderTransactions = jest.fn()
  const listOrderTransactions = jest.fn(() => Promise.resolve(options.transactions ?? []))
  const createRefunds = jest.fn(() => Promise.resolve({ id: "ref_NEW" }))
  const updatePayment = jest.fn()
  const updateOrderRefunds = jest.fn()
  const container = createMedusaContainer()
  container.register({
    [ContainerRegistrationKeys.QUERY]: asValue({
      graph: () =>
        Promise.resolve({
          data: [
            { currency_code: "try", data: options.data ?? {}, refunds: options.refunds ?? [] },
          ],
        }),
    }),
    [Modules.ORDER]: asValue({ listOrderTransactions, addOrderTransactions }),
    [Modules.PAYMENT]: asValue({
      listPayments: () => Promise.resolve([{ id: "pay_01", data: options.data ?? {} }]),
      createRefunds,
      updatePayment,
    }),
    [ORDER_REFUNDS_MODULE]: asValue({
      listOrderRefunds: () => Promise.resolve(options.ledger ?? []),
      updateOrderRefunds,
    }),
  })
  return {
    container,
    addOrderTransactions,
    listOrderTransactions,
    createRefunds,
    updatePayment,
    updateOrderRefunds,
  }
}

const recorded = (refundId?: string) => ({
  refunds: [
    { reference_no: REFERENCE, amount: 1000, ...(refundId ? { refund_id: refundId } : {}) },
  ],
})
const raw = { value: "10", precision: 20 }

describe("a refund refused outright fails at once; a lost answer waits (review 2026-11-17)", () => {
  it("tells a refusal from an answer that never came", () => {
    const provider = (providerCode: string) =>
      new ProviderError({ provider: "paytr", providerCode, retryable: false })

    expect(refusedOutright(new ValidationError("paytr.balance_insufficient"))).toBe(true)
    expect(refusedOutright(provider("error_002"))).toBe(true)
    expect(refusedOutright(new MedusaError(MedusaError.Types.INVALID_DATA, "too much"))).toBe(true)
    // As it travels back from a workflow: a plain object
    expect(refusedOutright({ qtErrorKind: "validation", safeMessage: "paytr.refund_locked" })).toBe(
      true
    )
    expect(refusedOutright(provider("outcome_unknown"))).toBe(false)
    expect(refusedOutright(provider("http_502"))).toBe(false)
    expect(refusedOutright(new Error("socket hang up"))).toBe(false)
  })
})

describe("a made refund's order money move is mended for its own refund alone (D1, D-3)", () => {
  it("writes the move of the refund the payment's data names, when there is none", async () => {
    const { container, addOrderTransactions, listOrderTransactions } = containerWith({
      data: recorded("ref_01"),
      refunds: [
        { id: "ref_00", raw_amount: raw },
        { id: "ref_01", raw_amount: raw },
      ],
    })

    expect(await restoreRefundTransaction(container, entry)).toBe(1)
    // Looked for by the refund's id alone, whatever its reference (Medusa's cancel writes the payment's)
    expect(listOrderTransactions).toHaveBeenCalledWith(
      { order_id: "order_01", reference_id: "ref_01" },
      expect.anything()
    )
    expect(addOrderTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "order_01", reference: "refund", reference_id: "ref_01" })
    )
  })

  it("writes nothing when the move is there, or no refund is named", async () => {
    const there = containerWith({
      data: recorded("ref_01"),
      refunds: [{ id: "ref_01", raw_amount: raw }],
      transactions: [{ id: "ordtrx_01" }],
    })
    const unnamed = containerWith({
      data: recorded(),
      refunds: [{ id: "ref_01", raw_amount: raw }],
    })

    expect(await restoreRefundTransaction(there.container, entry)).toBe(0)
    expect(await restoreRefundTransaction(unnamed.container, entry)).toBe(0)
    expect(there.addOrderTransactions).not.toHaveBeenCalled()
    expect(unnamed.addOrderTransactions).not.toHaveBeenCalled()
  })
})

describe("staff settle an open refund they checked at the provider (O2), sending nothing", () => {
  const open = { id: "oref_01", status: "pending", ...entry }
  const input = { order_id: "order_01", reference: REFERENCE, actor_id: "user_01" }

  it("closes it as made, with Medusa's refund record and its move when Medusa had none", async () => {
    const shop = containerWith({ ledger: [open], refunds: [{ id: "ref_NEW", raw_amount: raw }] })

    expect(await settleRefundByHand(shop.container, { ...input, outcome: "made" })).toEqual({
      reference: REFERENCE,
      status: "done",
    })
    expect(shop.createRefunds).toHaveBeenCalledWith(
      expect.objectContaining({ payment: "pay_01", created_by: "user_01" })
    )
    expect(shop.updatePayment).toHaveBeenCalledWith({
      id: "pay_01",
      data: { refunds: [{ reference_no: REFERENCE, amount: 1000, refund_id: "ref_NEW" }] },
    })
    expect(shop.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "done",
      error_code: "checked_made",
    })
  })

  it("writes no second Medusa refund for one the payment's data records", async () => {
    const shop = containerWith({ ledger: [open], data: recorded("ref_01") })

    await settleRefundByHand(shop.container, { ...input, outcome: "made" })

    expect(shop.createRefunds).not.toHaveBeenCalled()
  })

  it("fails it as not made, its lines free again, and touches no money record", async () => {
    const shop = containerWith({ ledger: [open] })

    expect(await settleRefundByHand(shop.container, { ...input, outcome: "not_made" })).toEqual({
      reference: REFERENCE,
      status: "failed",
    })
    expect(shop.createRefunds).not.toHaveBeenCalled()
    expect(shop.addOrderTransactions).not.toHaveBeenCalled()
    expect(shop.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "failed",
      error_code: "checked_not_made",
    })
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
