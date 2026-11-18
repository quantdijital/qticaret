import type { MedusaContainer } from "@medusajs/framework/types"
import { EINVOICE_MODULE } from "../../../modules/einvoice"
import type { PullableInvoice } from "../../../modules/einvoice/service"
import { MAX_PAGES, birfaturaOrders } from "../birfatura-orders"

// Orders numbered by their place; those below BROKEN have no phone (cannot be listed)
const BROKEN = 120

jest.mock("../draft-source", () => ({
  saleDraftSource: (_container: unknown, invoice: { order_id: string }) => {
    const number = Number(invoice.order_id.replace("order_", ""))
    return Promise.resolve({
      result: { draft: { number } },
      items: [],
      shipping: null,
      display_id: number,
      placed_at: new Date("2026-11-18T09:00:00Z"),
    })
  },
}))

jest.mock("../../../lib/invoicing/birfatura", () => {
  const actual = jest.requireActual<Record<string, unknown>>("../../../lib/invoicing/birfatura")
  return {
    ...actual,
    birfaturaOrder: (source: { order_id: number }) =>
      source.order_id <= BROKEN
        ? { problem: "einvoice.phone_missing" }
        : { order: { OrderId: source.order_id } },
  }
})

function shop(count: number) {
  const due: PullableInvoice[] = Array.from({ length: count }, (_, index) => ({
    id: `inv_${String(index + 1)}`,
    order_id: `order_${String(index + 1)}`,
    source_id: `order_${String(index + 1)}`,
    created_at: new Date("2026-11-18T08:00:00Z"),
  }))
  const service = {
    listBirfaturaDue: jest.fn((_range: unknown, limit: number, skip?: number) => {
      const from = skip ?? 0
      return Promise.resolve(due.slice(from, from + limit))
    }),
    noteProblem: jest.fn(() => Promise.resolve()),
  }
  const container = {
    resolve: (name: string) => (name === EINVOICE_MODULE ? service : undefined),
  } as unknown as MedusaContainer
  return { container, service }
}

const range = { start: new Date("2026-11-17T00:00:00Z"), end: new Date("2026-11-19T00:00:00Z") }

describe("BirFatura's pull past orders it cannot list (adr/0072, security review)", () => {
  it("reads on past a full page of orders it cannot list, to the ones behind them", async () => {
    const { container, service } = shop(150)

    const pulled = await birfaturaOrders(container, range)

    expect(pulled.orders.map((order) => order.OrderId)).toEqual(
      Array.from({ length: 30 }, (_, index) => BROKEN + index + 1)
    )
    expect(pulled.skipped).toHaveLength(BROKEN)
    expect(service.noteProblem).toHaveBeenCalledWith("inv_1", "einvoice.phone_missing")
    expect(service.listBirfaturaDue).toHaveBeenCalledTimes(2)
  })

  it("answers a hundred orders at most, and reads a bounded number of pages", async () => {
    const full = shop(BROKEN + 250)
    const stuck = shop(BROKEN)

    const many = await birfaturaOrders(full.container, range)
    const none = await birfaturaOrders(stuck.container, range)

    expect(many.orders).toHaveLength(100)
    expect(none.orders).toEqual([])
    expect(stuck.service.listBirfaturaDue.mock.calls.length).toBeLessThanOrEqual(MAX_PAGES)
  })
})
