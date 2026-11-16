import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import { PAYMENT_LINKS_MODULE } from "../../../modules/payment-links"
import type * as LinkCarts from "../link-carts"
import type * as Paid from "../paid"
import { settlePaymentLinks } from "../settle"

const markRun = jest.fn()
const completed = jest.fn()
jest.mock("../paid", () => ({
  ...jest.requireActual<typeof Paid>("../paid"),
  markPaymentLinkPaidWorkflow: () => ({ run: markRun }),
}))
jest.mock("../link-carts", () => ({
  ...jest.requireActual<typeof LinkCarts>("../link-carts"),
  completedLinkCarts: (...args: unknown[]) => completed(...args) as unknown,
}))

const query = { graph: jest.fn() }
const links = { listPaymentLinks: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({
    [ContainerRegistrationKeys.QUERY]: asValue(query),
    [PAYMENT_LINKS_MODULE]: asValue(links),
  })
  return made
}

const link = (overrides: Record<string, unknown>) => ({
  id: "plink_1",
  number: 1042,
  status: "open",
  order_id: null,
  ...overrides,
})
const MARKED = { qt_payment_link: "plink_1", qt_payment_link_number: 1042 }

beforeEach(() => {
  markRun.mockResolvedValue({ result: { paid: true }, errors: [] })
  query.graph.mockResolvedValue({ data: [{ id: "order_1", metadata: MARKED }] })
})
afterEach(() => {
  jest.resetAllMocks()
})

describe("settling payment links on the hour", () => {
  it("looks at every completed cart of a link these two days, oldest first", async () => {
    completed.mockResolvedValue([])
    const now = new Date("2026-11-16T12:00:00Z")

    await expect(settlePaymentLinks(container(), now)).resolves.toBe(0)
    expect(completed).toHaveBeenCalledWith(
      expect.anything(),
      { since: new Date("2026-11-14T12:00:00Z") },
      500
    )
  })

  it("closes a link still open whose cart (latest or given up) became an order", async () => {
    completed.mockResolvedValue([
      { cart_id: "cart_given_up", link_id: "plink_1", order_id: "order_1" },
      { cart_id: "cart_waiting", link_id: "plink_1", order_id: null },
    ])
    links.listPaymentLinks.mockResolvedValue([link({})])

    await expect(settlePaymentLinks(container())).resolves.toBe(1)
    expect(markRun).toHaveBeenCalledTimes(1)
    expect(markRun).toHaveBeenCalledWith({ input: { order_id: "order_1" }, throwOnError: false })
  })

  it("writes the number a paid link's order misses, and leaves a settled one alone", async () => {
    completed.mockResolvedValue([
      { cart_id: "cart_1", link_id: "plink_1", order_id: "order_1" },
      { cart_id: "cart_2", link_id: "plink_2", order_id: "order_2" },
    ])
    links.listPaymentLinks.mockResolvedValue([
      link({ status: "paid", order_id: "order_1" }),
      link({ id: "plink_2", number: 1043, status: "paid", order_id: "order_2" }),
    ])
    query.graph.mockResolvedValue({
      data: [
        { id: "order_1", metadata: { qt_payment_link: "plink_1" } },
        { id: "order_2", metadata: { qt_payment_link: "plink_2", qt_payment_link_number: 1043 } },
      ],
    })

    await settlePaymentLinks(container())

    expect(markRun).toHaveBeenCalledTimes(1)
    expect(markRun).toHaveBeenCalledWith({ input: { order_id: "order_1" }, throwOnError: false })
  })

  it("passes a second order of a link another order paid to the mark, for staff to check", async () => {
    completed.mockResolvedValue([{ cart_id: "cart_2", link_id: "plink_1", order_id: "order_2" }])
    links.listPaymentLinks.mockResolvedValue([link({ status: "paid", order_id: "order_1" })])
    markRun.mockResolvedValue({ result: { paid: false }, errors: [] })

    await expect(settlePaymentLinks(container())).resolves.toBe(0)
    expect(markRun).toHaveBeenCalledWith({ input: { order_id: "order_2" }, throwOnError: false })
  })

  it("logs a failed mark and goes on", async () => {
    completed.mockResolvedValue([{ cart_id: "cart_1", link_id: "plink_1", order_id: "order_1" }])
    links.listPaymentLinks.mockResolvedValue([link({})])
    markRun.mockResolvedValue({ result: undefined, errors: [{ error: new Error("db down") }] })

    await expect(settlePaymentLinks(container())).resolves.toBe(0)
  })
})
