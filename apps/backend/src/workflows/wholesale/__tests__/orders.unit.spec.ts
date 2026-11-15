import { stampWholesaleOrder, unstampWholesaleOrder, wholesaleOrders } from "../orders"

// A link is defined against the running app's modules; its query name is all that is read here
jest.mock("../../../links/wholesale-account-order", () => ({
  __esModule: true,
  default: { entryPoint: "order_wholesale_account" },
}))

function fakeContainer(fields: {
  order?: { customer_id: string | null }
  accounts?: { id: string }[]
  links?: { order_id: string; wholesale_account_id: string }[]
}) {
  const link = {
    create: jest.fn(() => Promise.resolve()),
    dismiss: jest.fn(() => Promise.resolve()),
  }
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
  return {
    container: { resolve: (key: string) => modules[key] } as never,
    link,
    graph,
    listWholesaleAccounts,
  }
}

describe("a wholesale order's stamp (ADR-0068 Ek 2026-11-15 (2))", () => {
  it("links an order to the active wholesaler who placed it", async () => {
    const fake = fakeContainer({ order: { customer_id: "cus_1" }, accounts: [{ id: "wacc_1" }] })
    expect(await stampWholesaleOrder(fake.container, "order_1")).toEqual({
      order_id: "order_1",
      account_id: "wacc_1",
    })
    expect(fake.listWholesaleAccounts).toHaveBeenCalledWith(
      { customer_id: "cus_1", status: "active" },
      { select: ["id"], take: 1 }
    )
    expect(fake.link.create).toHaveBeenCalledWith({
      order: { order_id: "order_1" },
      wholesale: { wholesale_account_id: "wacc_1" },
    })
  })

  it("leaves a guest's order, and one of a customer with no active account, retail", async () => {
    const guest = fakeContainer({ order: { customer_id: null } })
    expect(await stampWholesaleOrder(guest.container, "order_1")).toBeNull()
    const closed = fakeContainer({ order: { customer_id: "cus_1" }, accounts: [] })
    expect(await stampWholesaleOrder(closed.container, "order_1")).toBeNull()
    expect(closed.link.create).not.toHaveBeenCalled()
  })

  it("takes the stamp back with the order", async () => {
    const fake = fakeContainer({})
    await unstampWholesaleOrder(fake.container, { order_id: "order_1", account_id: "wacc_1" })
    expect(fake.link.dismiss).toHaveBeenCalledWith({
      order: { order_id: "order_1" },
      wholesale: { wholesale_account_id: "wacc_1" },
    })
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
