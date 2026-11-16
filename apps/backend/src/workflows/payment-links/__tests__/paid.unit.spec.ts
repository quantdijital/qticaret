import { asValue } from "@medusajs/framework/awilix"
import {
  ContainerRegistrationKeys,
  Modules,
  createMedusaContainer,
} from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { PAYMENT_LINKS_MODULE } from "../../../modules/payment-links"
import { markLinkPaidStep, markPaymentLinkPaidWorkflow } from "../paid"

interface Link {
  id: string
  number: number
  cart_id: string
  status: string
  order_id: string | null
  paid_at: Date | null
  closed_at: Date | null
  created_by: string
  items_total: number
  discount_total: number
}

const OPEN: Link = {
  id: "plink_1",
  number: 1042,
  cart_id: "cart_1",
  status: "open",
  order_id: null,
  paid_at: null,
  closed_at: null,
  created_by: "user_1",
  items_total: 300,
  discount_total: 30,
}
// The order carries the cart's link id from the start (Medusa copies the cart's metadata)
const PLACED = { qt_payment_link: "plink_1", gift_note: "kept" }
const MARKED = { ...PLACED, qt_payment_link_number: 1042, qt_payment_link_by: "user_1" }

let link: Link
let metadata: Record<string, unknown>

/** Medusa's metadata rule: top-level keys merge, "" removes one. */
function merge(into: Record<string, unknown>, patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries({ ...into, ...patch }).filter(([, value]) => value !== "")
  )
}

const query = { graph: jest.fn() }
const links = { listPaymentLinks: jest.fn(), updatePaymentLinks: jest.fn() }
const orders = { updateOrders: jest.fn() }
const notifications = { createNotifications: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({
    [ContainerRegistrationKeys.QUERY]: asValue(query),
    [PAYMENT_LINKS_MODULE]: asValue(links),
    [Modules.ORDER]: asValue(orders),
    [Modules.NOTIFICATION]: asValue(notifications),
  })
  return made
}

const settle = (promise: Promise<{ result: unknown }>) =>
  promise.then(
    ({ result }) => ({ result, error: null }),
    (error: unknown) => ({ result: null, error })
  )

const run = () =>
  settle(
    markPaymentLinkPaidWorkflow(container()).run({
      input: { order_id: "order_1" },
      throwOnError: true,
    })
  )

beforeEach(() => {
  link = { ...OPEN }
  metadata = { ...PLACED }
  query.graph.mockImplementation(() =>
    Promise.resolve({
      data: [{ id: "order_1", metadata, cart: { id: "cart_1", metadata: PLACED } }],
    })
  )
  links.listPaymentLinks.mockImplementation(() => Promise.resolve([{ ...link }]))
  links.updatePaymentLinks.mockImplementation((patch: Partial<Link>) => {
    link = { ...link, ...patch }
    return Promise.resolve(link)
  })
  orders.updateOrders.mockImplementation(
    (_id: string, patch: { metadata: Record<string, unknown> }) => {
      metadata = merge(metadata, patch.metadata)
      return Promise.resolve({ id: "order_1", metadata })
    }
  )
  notifications.createNotifications.mockResolvedValue([])
})
afterEach(() => {
  jest.resetAllMocks()
})

describe("marking a payment link paid", () => {
  it("writes the order's two keys, marks the link paid and rings the bell once", async () => {
    const { result, error } = await run()

    expect(error).toBeNull()
    expect(result).toEqual({ paid: true })
    expect(metadata).toEqual(MARKED)
    // Only the missing keys are sent: Medusa merges the rest
    expect(orders.updateOrders).toHaveBeenCalledWith("order_1", {
      metadata: { qt_payment_link_number: 1042, qt_payment_link_by: "user_1" },
    })
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(notifications.createNotifications).toHaveBeenCalledTimes(1)
    expect(notifications.createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_type: "payment_links.paid",
        idempotency_key: "payment_links.paid:plink_1",
      })
    )
  })

  it("undoes the order's keys when the link write fails, and the next run completes it", async () => {
    links.updatePaymentLinks.mockRejectedValueOnce(new Error("db down"))

    const first = await run()

    expect(first.error).not.toBeNull()
    expect(link.status).toBe("open")
    expect(metadata).toEqual(PLACED)
    expect(notifications.createNotifications).not.toHaveBeenCalled()

    const second = await run()

    expect(second.error).toBeNull()
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(metadata).toEqual(MARKED)
    expect(notifications.createNotifications).toHaveBeenCalledTimes(1)
  })

  it("leaves the link open when the order write fails, and the next run completes it", async () => {
    orders.updateOrders.mockRejectedValueOnce(new Error("db down"))

    const first = await run()

    expect(first.error).not.toBeNull()
    expect(link.status).toBe("open")
    expect(links.updatePaymentLinks).not.toHaveBeenCalled()
    expect(metadata).toEqual(PLACED)

    const second = await run()

    expect(second.error).toBeNull()
    expect(link.status).toBe("paid")
    expect(metadata).toEqual(MARKED)
    expect(notifications.createNotifications).toHaveBeenCalledTimes(1)
  })

  it("does nothing on a repeated event once all is written", async () => {
    await run()
    jest.clearAllMocks()

    const again = await run()

    expect(again).toEqual({ result: { paid: false }, error: null })
    expect(orders.updateOrders).not.toHaveBeenCalled()
    expect(links.updatePaymentLinks).not.toHaveBeenCalled()
    expect(notifications.createNotifications).not.toHaveBeenCalled()
  })

  it("writes the missing keys of a link this order already paid, without marking it again", async () => {
    link = { ...OPEN, status: "paid", order_id: "order_1" }

    const { result, error } = await run()

    expect(error).toBeNull()
    expect(result).toEqual({ paid: true })
    expect(metadata).toEqual(MARKED)
    expect(links.updatePaymentLinks).not.toHaveBeenCalled()
    // The bell of a run cut short: its idempotency key keeps it to one
    expect(notifications.createNotifications).toHaveBeenCalledTimes(1)
  })

  it("leaves alone a link another order paid", async () => {
    link = { ...OPEN, status: "paid", order_id: "order_other" }

    const { result } = await run()

    expect(result).toEqual({ paid: false })
    expect(orders.updateOrders).not.toHaveBeenCalled()
    expect(links.updatePaymentLinks).not.toHaveBeenCalled()
    expect(notifications.createNotifications).not.toHaveBeenCalled()
  })
})

describe("undoing a paid mark", () => {
  const failAfter = createStep("test-fail-after-paid", () => {
    throw new Error("a later step failed")
    return new StepResponse(undefined)
  })
  const composed = createWorkflow(
    "test-payment-links-mark-paid-then-fail",
    (input: { order_id: string }) => {
      markLinkPaidStep(input)
      failAfter()
      return new WorkflowResponse(undefined)
    }
  )

  it("puts the link back as it was and only the order's keys it wrote", async () => {
    const { error } = await settle(
      composed(container()).run({ input: { order_id: "order_1" }, throwOnError: true })
    )

    expect(error).not.toBeNull()
    expect(link).toEqual(OPEN)
    // The cart's link id and the order's other keys were there before: they stay
    expect(metadata).toEqual(PLACED)
    expect(orders.updateOrders).toHaveBeenLastCalledWith("order_1", {
      metadata: { qt_payment_link_number: "", qt_payment_link_by: "" },
    })
  })
})
