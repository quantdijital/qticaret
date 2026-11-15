import { stampWholesaleOrder, wholesaleAt, wholesaleOrders } from "../orders"

// A link is defined against the running app's modules; its query name is all that is read here
jest.mock("../../../links/wholesale-account-order", () => ({
  __esModule: true,
  default: { entryPoint: "order_wholesale_account" },
}))

const PLACED = "2026-11-15T12:00:00.000Z"

interface AccountRow {
  id: string
  status: string
  activated_at: string | null
  deactivated_at: string | null
}

const active = (more: Partial<AccountRow> = {}): AccountRow => ({
  id: "wacc_1",
  status: "active",
  activated_at: "2026-11-10T09:00:00.000Z",
  deactivated_at: null,
  ...more,
})

function fakeContainer(fields: {
  order?: { customer_id: string | null; created_at: string }
  accounts?: AccountRow[]
  links?: { order_id: string; wholesale_account_id: string }[]
}) {
  const link = { create: jest.fn(() => Promise.resolve()) }
  const listWholesaleAccounts = jest.fn(() => Promise.resolve(fields.accounts ?? []))
  const graph = jest.fn(({ entity }: { entity: string }) =>
    Promise.resolve({
      data: entity === "order" ? (fields.order ? [fields.order] : []) : (fields.links ?? []),
    })
  )
  const modules: Record<string, unknown> = {
    query: { graph },
    link,
    wholesale: { listWholesaleAccounts },
  }
  return { container: { resolve: (key: string) => modules[key] } as never, link, graph }
}

describe("a wholesale order's stamp (ADR-0068 Ek 2026-11-15 (2))", () => {
  it("decides as of the order's placing: active by then, not closed before it", () => {
    expect(wholesaleAt(active(), PLACED)).toBe(true)
    expect(wholesaleAt(active({ activated_at: "2026-11-15T12:00:01.000Z" }), PLACED)).toBe(false)
    // Closed a moment after the order, before the stamp ran: still a wholesale order
    expect(
      wholesaleAt(
        active({ status: "inactive", deactivated_at: "2026-11-15T12:00:05.000Z" }),
        PLACED
      )
    ).toBe(true)
    expect(
      wholesaleAt(
        active({ status: "inactive", deactivated_at: "2026-11-14T12:00:00.000Z" }),
        PLACED
      )
    ).toBe(false)
    expect(wholesaleAt(active({ status: "pending", activated_at: null }), PLACED)).toBe(false)
  })

  it("links an order to the wholesaler its customer was when it was placed", async () => {
    const fake = fakeContainer({
      order: { customer_id: "cus_1", created_at: PLACED },
      accounts: [active()],
    })
    expect(await stampWholesaleOrder(fake.container, "order_1")).toEqual({
      order_id: "order_1",
      account_id: "wacc_1",
    })
    expect(fake.link.create).toHaveBeenCalledWith({
      order: { order_id: "order_1" },
      wholesale: { wholesale_account_id: "wacc_1" },
    })
  })

  it("leaves a guest's order, and one of a customer with no account then, retail", async () => {
    const guest = fakeContainer({ order: { customer_id: null, created_at: PLACED } })
    expect(await stampWholesaleOrder(guest.container, "order_1")).toBeNull()
    const closed = fakeContainer({
      order: { customer_id: "cus_1", created_at: PLACED },
      accounts: [active({ status: "inactive", deactivated_at: "2026-11-01T00:00:00.000Z" })],
    })
    expect(await stampWholesaleOrder(closed.container, "order_1")).toBeNull()
    expect(closed.link.create).not.toHaveBeenCalled()
  })

  it("writes nothing twice for a repeated event", async () => {
    const fake = fakeContainer({
      order: { customer_id: "cus_1", created_at: PLACED },
      accounts: [active()],
      links: [{ order_id: "order_1", wholesale_account_id: "wacc_1" }],
    })
    expect(await stampWholesaleOrder(fake.container, "order_1")).toBeNull()
    expect(fake.link.create).not.toHaveBeenCalled()
  })

  it("reads which orders are wholesale, and by whom; none asked, none read", async () => {
    const fake = fakeContainer({
      links: [{ order_id: "order_1", wholesale_account_id: "wacc_1" }],
    })
    expect(await wholesaleOrders(fake.container, { order_ids: [] })).toEqual(new Map())
    expect(fake.graph).not.toHaveBeenCalled()
    expect(await wholesaleOrders(fake.container, { order_ids: ["order_1", "order_2"] })).toEqual(
      new Map([["order_1", "wacc_1"]])
    )
  })
})
