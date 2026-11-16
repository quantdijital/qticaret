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
import { logger } from "../../../lib/logging"
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
const MARKED = { ...PLACED, qt_payment_link_number: 1042 }

let link: Link
let metadata: Record<string, unknown>
let cartId: string
let provider: string
/** The bells written, by idempotency key (the notification module skips a key it has). */
let bells: Map<string, { trigger_type: string; data?: unknown }>

/** Medusa's metadata rule: top-level keys merge, "" removes one. */
function merge(into: Record<string, unknown>, patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries({ ...into, ...patch }).filter(([, value]) => value !== "")
  )
}

interface GuardedUpdate {
  selector: { id: string; status: { $ne: string } }
  data: Partial<Link>
}

const query = { graph: jest.fn() }
const links = { listPaymentLinks: jest.fn(), updatePaymentLinks: jest.fn() }
const orders = { updateOrders: jest.fn() }
const notifications = { createNotifications: jest.fn(), listNotifications: jest.fn() }

/** The locking module as one process sees it: one holder per key, the rest wait their turn. */
const held = new Map<string, Promise<unknown>>()
const locking = { execute: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({
    [ContainerRegistrationKeys.QUERY]: asValue(query),
    [PAYMENT_LINKS_MODULE]: asValue(links),
    [Modules.ORDER]: asValue(orders),
    [Modules.NOTIFICATION]: asValue(notifications),
    [Modules.LOCKING]: asValue(locking),
  })
  return made
}

const settle = (promise: Promise<{ result: unknown }>) =>
  promise.then(
    ({ result }) => ({ result, error: null }),
    (error: unknown) => ({ result: null, error })
  )

const run = (orderId = "order_1") =>
  settle(
    markPaymentLinkPaidWorkflow(container()).run({
      input: { order_id: orderId },
      throwOnError: true,
    })
  )

const triggers = () => [...bells.values()].map((bell) => bell.trigger_type).sort()

beforeEach(() => {
  link = { ...OPEN }
  metadata = { ...PLACED }
  cartId = "cart_1"
  provider = "pp_system_default"
  bells = new Map()
  held.clear()
  locking.execute.mockImplementation(async (key: string, work: () => Promise<unknown>) => {
    const before = held.get(key) ?? Promise.resolve()
    const mine = before.then(work, work)
    held.set(
      key,
      mine.catch(() => undefined)
    )
    return mine
  })
  query.graph.mockImplementation(({ filters }: { filters: { id: string } }) =>
    Promise.resolve({
      data: [
        {
          id: filters.id,
          metadata,
          cart: { id: cartId, metadata: PLACED },
          payment_collections: [{ payment_sessions: [{ provider_id: provider }] }],
        },
      ],
    })
  )
  links.listPaymentLinks.mockImplementation(() => Promise.resolve([{ ...link }]))
  // Medusa's guarded write reads, then writes (a moment between): a link paid already is
  // not touched, unless another write slips in between, which only the lock prevents
  links.updatePaymentLinks.mockImplementation(async ({ selector, data }: GuardedUpdate) => {
    const read = { ...link }
    await new Promise((resolve) => setTimeout(resolve, 5))
    if (read.id !== selector.id || read.status === selector.status.$ne) {
      return []
    }
    link = { ...link, ...data }
    return [link]
  })
  orders.updateOrders.mockImplementation(
    (_id: string, patch: { metadata: Record<string, unknown> }) => {
      metadata = merge(metadata, patch.metadata)
      return Promise.resolve({ id: "order_1", metadata })
    }
  )
  notifications.createNotifications.mockImplementation(
    (bell: { idempotency_key: string; trigger_type: string }) => {
      if (!bells.has(bell.idempotency_key)) {
        bells.set(bell.idempotency_key, bell)
      }
      return Promise.resolve([])
    }
  )
  notifications.listNotifications.mockImplementation(
    ({ idempotency_key }: { idempotency_key: string }) =>
      Promise.resolve(bells.has(idempotency_key) ? [{ id: "noti_1" }] : [])
  )
})
afterEach(() => {
  jest.resetAllMocks()
})

describe("marking a payment link paid", () => {
  it("closes the link first under its lock, then writes the order's number, and rings the bell once", async () => {
    const { result, error } = await run()

    expect(error).toBeNull()
    expect(result).toEqual({ paid: true })
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(locking.execute).toHaveBeenCalledWith(
      "payment-link:plink_1",
      expect.any(Function),
      expect.objectContaining({ timeout: expect.any(Number) as unknown })
    )
    expect(links.updatePaymentLinks.mock.invocationCallOrder[0]).toBeLessThan(
      orders.updateOrders.mock.invocationCallOrder[0] ?? 0
    )
    // Only the missing key is sent (Medusa merges the rest); the link's maker stays the link's
    expect(orders.updateOrders).toHaveBeenCalledWith("order_1", {
      metadata: { qt_payment_link_number: 1042 },
    })
    expect(metadata).toEqual(MARKED)
    expect([...bells.keys()]).toEqual(["payment_links.paid:plink_1"])
    expect([...bells.values()][0]).toMatchObject({
      data: { title: expect.stringMatching(/ödendi/u) as unknown },
    })
  })

  it("lets one of two orders at once hold the link; the other is for staff to check", async () => {
    const [first, second] = await Promise.all([run("order_1"), run("order_2")])

    expect([first.result, second.result]).toEqual([{ paid: true }, { paid: false }])
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect([...bells.keys()].sort()).toEqual([
      "payment_links.needs_review:plink_1:order_2",
      "payment_links.paid:plink_1",
    ])
  })

  it("words the bell 'ordered' for a link paid at the door", async () => {
    provider = "pp_cod_cod"

    await run()

    expect([...bells.values()]).toEqual([
      expect.objectContaining({
        trigger_type: "payment_links.paid",
        data: expect.objectContaining({
          payment_due: "on_delivery",
          title: expect.stringMatching(/sipariş verildi/u) as unknown,
        }) as unknown,
      }),
    ])
  })

  it("rings no link bell for a bank transfer: the order's own alert says the money is awaited", async () => {
    provider = "pp_bank-transfer_bank-transfer"

    const { result } = await run()

    expect(result).toEqual({ paid: true })
    expect(link.status).toBe("paid")
    expect(bells.size).toBe(0)
  })

  it("does not take the lock again when its caller holds it (opening a cart)", async () => {
    await settle(
      markPaymentLinkPaidWorkflow(container()).run({
        input: { order_id: "order_1", link_locked: true },
        throwOnError: true,
      })
    )

    expect(locking.execute).not.toHaveBeenCalled()
    expect(link.status).toBe("paid")
  })

  it("keeps the link paid when the order's write fails, and the next run writes the keys", async () => {
    orders.updateOrders.mockRejectedValueOnce(new Error("db down"))

    const first = await run()

    expect(first).toEqual({ result: { paid: true }, error: null })
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(metadata).toEqual(PLACED)

    const second = await run()

    expect(second).toEqual({ result: { paid: true }, error: null })
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(metadata).toEqual(MARKED)
    expect(triggers()).toEqual(["payment_links.paid"])
  })

  it("writes nothing to the order when the link's write fails; the next run does it all", async () => {
    links.updatePaymentLinks.mockRejectedValueOnce(new Error("db down"))

    const first = await run()

    expect(first.error).not.toBeNull()
    expect(link.status).toBe("open")
    expect(orders.updateOrders).not.toHaveBeenCalled()
    expect(bells.size).toBe(0)

    const second = await run()

    expect(second.error).toBeNull()
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(metadata).toEqual(MARKED)
    expect(triggers()).toEqual(["payment_links.paid"])
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
    expect(triggers()).toEqual(["payment_links.paid"])
  })

  it("tells staff of an order from a link another order paid, and writes nothing", async () => {
    link = { ...OPEN, status: "paid", order_id: "order_other" }

    const { result } = await run()

    expect(result).toEqual({ paid: false })
    expect(orders.updateOrders).not.toHaveBeenCalled()
    expect(links.updatePaymentLinks).not.toHaveBeenCalled()
    expect([...bells.keys()]).toEqual(["payment_links.needs_review:plink_1:order_1"])
  })

  it("logs such an order once, however often the event or the hourly settle finds it", async () => {
    link = { ...OPEN, status: "paid", order_id: "order_other" }
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)

    await run()
    await run()
    await run()

    const twice = error.mock.calls.filter(
      ([entry]) => (entry as { event?: string }).event === "payment_links.paid_twice"
    )
    expect(twice).toEqual([
      [{ event: "payment_links.paid_twice", linkId: "plink_1", orderId: "order_1" }],
    ])
    expect(notifications.createNotifications).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  it("logs it again while its bell could not be written, so it is not lost", async () => {
    link = { ...OPEN, status: "paid", order_id: "order_other" }
    notifications.createNotifications.mockRejectedValue(new Error("db down"))
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    jest.spyOn(logger, "warn").mockImplementation(() => undefined)

    await run()
    await run()

    const twice = error.mock.calls.filter(
      ([entry]) => (entry as { event?: string }).event === "payment_links.paid_twice"
    )
    expect(twice).toHaveLength(2)
    jest.restoreAllMocks()
  })

  it("closes a link whose order came from an earlier cart, and tells staff", async () => {
    cartId = "cart_superseded"

    const { result } = await run()

    expect(result).toEqual({ paid: true })
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(triggers()).toEqual(["payment_links.needs_review", "payment_links.paid"])
  })

  it("keeps the closing time of a link that expired, and tells staff", async () => {
    const closed = new Date("2026-11-15T10:00:00Z")
    link = { ...OPEN, status: "expired", closed_at: closed }

    await run()

    expect(link).toMatchObject({ status: "paid", order_id: "order_1", closed_at: closed })
    expect(triggers()).toEqual(["payment_links.needs_review", "payment_links.paid"])
  })

  it("never overwrites a link another run paid in between", async () => {
    // Read as open, paid by another order before the write
    links.listPaymentLinks
      .mockResolvedValueOnce([{ ...OPEN }])
      .mockResolvedValue([{ ...OPEN, status: "paid", order_id: "order_other" }])
    link = { ...OPEN, status: "paid", order_id: "order_other" }

    const { result } = await run()

    expect(result).toEqual({ paid: false })
    expect(link.order_id).toBe("order_other")
    expect(orders.updateOrders).not.toHaveBeenCalled()
    expect(triggers()).toEqual(["payment_links.needs_review"])
  })

  it("rings the paid bell even when the bell fails, without failing the step", async () => {
    notifications.createNotifications.mockRejectedValue(new Error("feed down"))

    const { result, error } = await run()

    expect(error).toBeNull()
    expect(result).toEqual({ paid: true })
    expect(metadata).toEqual(MARKED)
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

  it("takes back only the order's keys it wrote and never opens the paid link again", async () => {
    const { error } = await settle(
      composed(container()).run({ input: { order_id: "order_1" }, throwOnError: true })
    )

    expect(error).not.toBeNull()
    expect(link).toMatchObject({ status: "paid", order_id: "order_1" })
    expect(links.updatePaymentLinks).toHaveBeenCalledTimes(1)
    // The cart's link id and the order's other keys were there before: they stay
    expect(metadata).toEqual(PLACED)
    expect(orders.updateOrders).toHaveBeenLastCalledWith("order_1", {
      metadata: { qt_payment_link_number: "" },
    })
  })
})
