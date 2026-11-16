import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import { PAYMENT_LINKS_MODULE } from "../../../modules/payment-links"
import type * as Paid from "../paid"
import { settlePaymentLinks } from "../settle"

const markRun = jest.fn()
jest.mock("../paid", () => ({
  ...jest.requireActual<typeof Paid>("../paid"),
  markPaymentLinkPaidWorkflow: () => ({ run: markRun }),
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
  cart_id: "cart_1",
  order_id: null,
  created_by: "user_1",
  ...overrides,
})

beforeEach(() => {
  markRun.mockResolvedValue({ result: { paid: true }, errors: [] })
})
afterEach(() => {
  jest.resetAllMocks()
})

describe("settling payment links on the hour", () => {
  it("pays an open link whose cart became an order, and leaves one still being paid", async () => {
    links.listPaymentLinks.mockResolvedValue([
      link({}),
      link({ id: "plink_2", number: 1043, cart_id: "cart_2" }),
    ])
    query.graph.mockResolvedValueOnce({
      data: [
        { id: "cart_1", completed_at: new Date(), order: { id: "order_1" } },
        { id: "cart_2", completed_at: null, order: null },
      ],
    })

    const settled = await settlePaymentLinks(container())

    expect(settled).toBe(1)
    expect(markRun).toHaveBeenCalledTimes(1)
    expect(markRun).toHaveBeenCalledWith({ input: { order_id: "order_1" }, throwOnError: false })
  })

  it("writes the keys a paid link's order misses, and leaves a complete one alone", async () => {
    links.listPaymentLinks.mockResolvedValue([
      link({ status: "paid", cart_id: "cart_1", order_id: "order_1" }),
      link({ id: "plink_2", number: 1043, status: "paid", cart_id: "cart_2", order_id: "order_2" }),
    ])
    query.graph.mockResolvedValueOnce({
      data: [
        { id: "order_1", metadata: { qt_payment_link: "plink_1" } },
        {
          id: "order_2",
          metadata: {
            qt_payment_link: "plink_2",
            qt_payment_link_number: 1043,
            qt_payment_link_by: "user_1",
          },
        },
      ],
    })

    await settlePaymentLinks(container())

    expect(markRun).toHaveBeenCalledTimes(1)
    expect(markRun).toHaveBeenCalledWith({ input: { order_id: "order_1" }, throwOnError: false })
  })

  it("logs a failed mark and goes on", async () => {
    links.listPaymentLinks.mockResolvedValue([link({})])
    query.graph.mockResolvedValueOnce({
      data: [{ id: "cart_1", completed_at: new Date(), order: { id: "order_1" } }],
    })
    markRun.mockResolvedValue({ result: undefined, errors: [{ error: new Error("db down") }] })

    await expect(settlePaymentLinks(container())).resolves.toBe(0)
  })
})
