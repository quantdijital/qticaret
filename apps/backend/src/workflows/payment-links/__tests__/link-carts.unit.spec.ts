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
  it("finds every completed cart of one link by its metadata, with its order", async () => {
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
    expect(sql).toMatch(/completed_at IS NOT NULL/u)
    expect(sql).toMatch(/ORDER BY completed_at ASC/u)
    // Every value bound, the link's id among them
    expect(values).toEqual(["qt_payment_link", "qt_payment_link", "qt_payment_link", "plink_1", 10])
  })

  it("pages the carts completed since a time by id, past the page before's last", async () => {
    knex.raw.mockResolvedValue({ rows: [] })
    const since = new Date("2026-11-14T12:00:00Z")

    await completedLinkCarts(container(), { since })
    await completedLinkCarts(container(), { since, after: "cart_499" }, 500)

    const [first, firstValues] = knex.raw.mock.calls[0] as [string, unknown[]]
    const [next, nextValues] = knex.raw.mock.calls[1] as [string, unknown[]]
    expect(first).toMatch(/ORDER BY id\s/u)
    expect(first).not.toMatch(/id > \?/u)
    expect(firstValues).toEqual(["qt_payment_link", "qt_payment_link", since, 500])
    expect(next).toMatch(/AND completed_at >= \? AND id > \?/u)
    expect(next).toMatch(/ORDER BY id\s/u)
    expect(nextValues).toEqual(["qt_payment_link", "qt_payment_link", since, "cart_499", 500])
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
