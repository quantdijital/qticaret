import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { CONFIRM_MS, ESCALATE_MS, STRANDED_MS, settleOpenRefunds } from "../settle-open-refunds"

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

type Entry = ReturnType<typeof entryOf>
const entryOf = (fields: Record<string, unknown> = {}) => ({
  id: "oref_01",
  order_id: "order_01",
  reference: "0123456789abcdef0123456789abcdef",
  payment_id: "pay_01",
  amount: 1000,
  provider_parts: null,
  status: "pending",
  error_code: "refund_incomplete" as string | null,
  created_at: ago(10 * 60 * 1000),
  updated_at: ago(5 * 60 * 1000),
  ...fields,
})

/** The ledger as one round reads it: pages by id, then each entry again under the lock. */
function ledgerWith(pages: Entry[][], reread?: (entry: Entry) => unknown) {
  const updateOrderRefunds = jest.fn()
  const all = pages.flat()
  const listOrderRefunds = jest.fn((filters: { id?: unknown; status?: unknown }) => {
    if (typeof filters.id === "string") {
      const entry = all.find(({ id }) => id === filters.id)
      return Promise.resolve(entry ? [reread ? reread(entry) : entry] : [])
    }
    return Promise.resolve(pages.shift() ?? [])
  })
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
    const { container, updateOrderRefunds } = ledgerWith([[entry]])
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

  it("marks a PayTR refund shown nothing as unconfirmed, then fails it long after", async () => {
    traceIs("none")
    const first = ledgerWith([[entryOf()]])
    await settleOpenRefunds(first.container, NOW)
    const recent = ledgerWith([[entryOf({ error_code: "refund_unconfirmed" })]])
    await settleOpenRefunds(recent.container, NOW)
    const old = ledgerWith([
      [entryOf({ error_code: "refund_unconfirmed", updated_at: ago(CONFIRM_MS) })],
    ])

    expect(await settleOpenRefunds(old.container, NOW)).toEqual({ closed: 0, failed: 1, open: 0 })
    expect(first.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "pending",
      error_code: "refund_unconfirmed",
    })
    expect(recent.updateOrderRefunds).not.toHaveBeenCalled()
    expect(old.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "failed",
      error_code: "refund_failed",
    })
  })

  it("fails at once where nothing shown is proof, or the provider refused outright", async () => {
    traceIs("none", "iyzico")
    const iyzico = ledgerWith([[entryOf()]])
    await settleOpenRefunds(iyzico.container, NOW)
    traceIs("unknown")
    const refused = ledgerWith([
      [entryOf({ error_code: "provider_refused", updated_at: ago(STRANDED_MS) })],
    ])
    await settleOpenRefunds(refused.container, NOW)

    for (const { updateOrderRefunds } of [iyzico, refused]) {
      expect(updateOrderRefunds).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", error_code: "refund_failed" })
      )
    }
  })

  it("reads an entry a crash left unmarked only once it is surely no refund under way (O2)", async () => {
    traceIs("unknown")
    const young = ledgerWith([[entryOf({ error_code: null, updated_at: ago(STRANDED_MS - 1) })]])
    const stranded = ledgerWith([[entryOf({ error_code: null, updated_at: ago(STRANDED_MS) })]])

    expect(await settleOpenRefunds(young.container, NOW)).toEqual({
      closed: 0,
      failed: 0,
      open: 0,
    })
    expect(await settleOpenRefunds(stranded.container, NOW)).toEqual({
      closed: 0,
      failed: 0,
      open: 1,
    })
    expect(refundTraceOf).toHaveBeenCalledTimes(1)
    expect(stranded.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "pending",
      error_code: "refund_incomplete",
    })
  })

  it("leaves one it cannot read, and tells the shop once it is an hour old", async () => {
    traceIs("unknown")
    const young = ledgerWith([[entryOf()]])
    await settleOpenRefunds(young.container, NOW)
    expect(alertPaymentIssue).not.toHaveBeenCalled()

    const old = ledgerWith([[entryOf({ created_at: ago(ESCALATE_MS) })]])
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

  it("leaves an entry written meanwhile as it is, even with the same code (D-1)", async () => {
    traceIs("none")
    const { container, updateOrderRefunds } = ledgerWith([[entryOf()]], (entry) => ({
      ...entry,
      updated_at: new Date(NOW),
    }))

    await settleOpenRefunds(container, NOW)

    expect(updateOrderRefunds).not.toHaveBeenCalled()
  })

  it("reads every page by id, the second after the first (D-5)", async () => {
    traceIs("unknown")
    const page = Array.from({ length: 100 }, (_, index) =>
      entryOf({ id: `oref_${String(index).padStart(3, "0")}` })
    )
    const { container, listOrderRefunds } = ledgerWith([page, [entryOf({ id: "oref_100" })]])

    expect(await settleOpenRefunds(container, NOW)).toEqual({ closed: 0, failed: 0, open: 101 })
    const lists = listOrderRefunds.mock.calls.filter(([filters]) => filters.status === "pending")
    expect(lists[1]?.[0]).toMatchObject({ id: { $gt: "oref_099" } })
  })
})
