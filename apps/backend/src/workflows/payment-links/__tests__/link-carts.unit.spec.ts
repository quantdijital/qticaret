import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { completedLinkCarts } from "../link-carts"

const knex = { raw: jest.fn() }
const query = { graph: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({
    [ContainerRegistrationKeys.PG_CONNECTION]: asValue(knex),
    [ContainerRegistrationKeys.QUERY]: asValue(query),
  })
  return made
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.resetAllMocks()
})

describe("completedLinkCarts", () => {
  it("finds every completed cart of one link through payment_link_cart, with its order", async () => {
    knex.raw.mockResolvedValue({
      rows: [
        { id: "cart_1", link_id: "plink_1" },
        { id: "cart_2", link_id: "plink_1" },
      ],
    })
    query.graph.mockResolvedValue({
      data: [
        { id: "cart_1", completed_at: new Date(), order: { id: "order_1" } },
        { id: "cart_2", completed_at: null, order: null },
      ],
    })

    const carts = await completedLinkCarts(container(), { link_id: "plink_1" }, 10)

    expect(carts).toEqual([
      { cart_id: "cart_1", link_id: "plink_1", order_id: "order_1" },
      { cart_id: "cart_2", link_id: "plink_1", order_id: null },
    ])
    const [sql, values] = knex.raw.mock.calls[0] as [string, unknown[]]
    // The links' own tables first (the carts kept, and the link's latest), the carts by id
    expect(sql).toMatch(
      /FROM payment_link_cart plc\s+WHERE plc\.deleted_at IS NULL AND plc\.link_id = \?/u
    )
    expect(sql).toMatch(/UNION\s+SELECT pl\.cart_id, pl\.id AS link_id\s+FROM payment_link pl/u)
    expect(sql).toMatch(/AND pl\.id = \?\) x\s+JOIN cart c ON c\.id = x\.cart_id/u)
    expect(sql).toMatch(/c\.completed_at IS NOT NULL/u)
    expect(sql).toMatch(/ORDER BY c\.completed_at ASC, x\.cart_id/u)
    // Never the carts' JSON metadata
    expect(sql).not.toMatch(/metadata/u)
    // Every value bound, the link's id in both halves
    expect(values).toEqual(["plink_1", "plink_1", 10])
  })

  it("pages the carts completed since a time by id, newest first, past the page before's last", async () => {
    knex.raw.mockResolvedValue({ rows: [] })
    const since = new Date("2026-11-14T12:00:00Z")

    await completedLinkCarts(container(), { since })
    await completedLinkCarts(container(), { since, after: "cart_499" }, 500)

    const [first, firstValues] = knex.raw.mock.calls[0] as [string, unknown[]]
    const [next, nextValues] = knex.raw.mock.calls[1] as [string, unknown[]]
    expect(first).toMatch(/FROM payment_link_cart plc/u)
    expect(first).toMatch(/FROM payment_link pl\s/u)
    // Every link's carts: no link's id asked for
    expect(first).not.toMatch(/link_id = \?|pl\.id = \?/u)
    expect(first).not.toMatch(/metadata/u)
    expect(first).toMatch(/ORDER BY x\.cart_id DESC\s/u)
    expect(first).not.toMatch(/cart_id < \?/u)
    expect(firstValues).toEqual([since, 500])
    expect(next).toMatch(/AND c\.completed_at >= \? AND x\.cart_id < \?/u)
    expect(next).toMatch(/ORDER BY x\.cart_id DESC\s/u)
    expect(nextValues).toEqual([since, "cart_499", 500])
  })

  it("says so when a completed cart shows no order", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
    knex.raw.mockResolvedValue({ rows: [{ id: "cart_1", link_id: "plink_1" }] })
    query.graph.mockResolvedValue({
      data: [{ id: "cart_1", completed_at: new Date(), order: null }],
    })

    const carts = await completedLinkCarts(container(), { since: new Date() })

    expect(carts).toEqual([{ cart_id: "cart_1", link_id: "plink_1", order_id: null }])
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "payment_links.completed_cart_without_order" })
    )
  })
})
