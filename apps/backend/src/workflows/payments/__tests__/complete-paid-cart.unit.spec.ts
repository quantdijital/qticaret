import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import { STUCK_ATTEMPTS, completePaidCart } from "../steps/complete-paid-cart"

// Medusa's completion, as this test drives it (its own checks are Medusa's)
const completeRun = jest.fn()
jest.mock("@medusajs/medusa/core-flows", () => ({
  completeCartWorkflow: () => ({ run: completeRun }),
}))
const backorderRun = jest.fn()
jest.mock("../complete-backorder", () => ({
  completePaidCartAsBackorderWorkflow: () => ({ run: backorderRun }),
}))
const markStockShortFromShelf = jest.fn<Promise<void>, unknown[]>()
jest.mock("../stock-short-mark", () => ({
  markStockShortFromShelf: (...args: unknown[]) => markStockShortFromShelf(...args),
}))
const alertPaymentIssue = jest.fn<Promise<void>, unknown[]>()
jest.mock("../issue-alert", () => ({
  alertPaymentIssue: (...args: unknown[]) => alertPaymentIssue(...args),
}))

const SESSION = "payses_01JABCDEFGHJKMNPQRSTVWXYZ0"
const OTHER = "payses_01JZZZZZZZZZZZZZZZZZZZZZZ0"

const verdict = {
  kind: "complete" as const,
  cart_id: "cart_01",
  amount: 21000,
  currency_code: "try",
  test_mode: true,
  provider: "paytr",
  reference: "payses01JABCDEFGHJKMNPQRSTVWXYZ0",
  session_id: SESSION,
  attempts: 2,
}

const notOrdered = { completed_at: null, order: null }
const ordered = (session: string) => ({
  completed_at: "2026-11-16T10:00:00Z",
  order: { id: "order_01" },
  payment_collection: { payments: [{ payment_session_id: session, data: {} }] },
})
// A refusal of the cart's own rules, as the validate hook throws it
const refused = { errors: [{ error: { safeMessage: "cart.payment_link_closed", message: "x" } }] }

/** The cart as each read finds it, in turn (the last one stays). */
function containerReading(...rows: unknown[]) {
  const graph = jest.fn(() => {
    const row = rows.length > 1 ? rows.shift() : rows[0]
    return row instanceof Error ? Promise.reject(row) : Promise.resolve({ data: [row] })
  })
  const made = createMedusaContainer()
  made.register({ [ContainerRegistrationKeys.QUERY]: asValue({ graph }) })
  return { container: made, graph }
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe("completePaidCart never gives back a placed order's money (finding 2026-11-16)", () => {
  it("answers a cart already an order with that order, completing and judging nothing", async () => {
    const { container } = containerReading(ordered(SESSION))

    const result = await completePaidCart(container, verdict)

    expect(result).toEqual({ order_id: "order_01", will_fail_again: false })
    expect(completeRun).not.toHaveBeenCalled()
    expect(alertPaymentIssue).not.toHaveBeenCalled()
    expect(markStockShortFromShelf).toHaveBeenCalledWith(container, "order_01")
  })

  it("tells the shop of a payment beside the order (review N2), and gives nothing back", async () => {
    const { container } = containerReading(ordered(OTHER))

    const result = await completePaidCart(container, verdict)

    expect(result).toEqual({ order_id: "order_01", will_fail_again: false })
    expect(completeRun).not.toHaveBeenCalled()
    expect(alertPaymentIssue).toHaveBeenCalledWith(container, {
      issue: "payment_beside_order",
      provider: "paytr",
      reference: verdict.reference,
      cart_id: "cart_01",
      amount: 21000,
    })
  })

  it("never reads a refusal as a refund once the cart became an order meanwhile", async () => {
    const { container } = containerReading(notOrdered, ordered(SESSION))
    completeRun.mockResolvedValue(refused)

    const result = await completePaidCart(container, verdict)

    expect(result).toEqual({ order_id: "order_01", will_fail_again: false })
    expect(backorderRun).not.toHaveBeenCalled()
  })

  it("tries again a cart marked completed whose order cannot be read: never a refund", async () => {
    const { container } = containerReading({ completed_at: new Date(), order: null })

    await expect(completePaidCart(container, verdict)).rejects.toMatchObject({
      safeMessage: "payments.completed_cart_without_order",
    })
    expect(completeRun).not.toHaveBeenCalled()
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })

  it("tells the shop once such a cart has come back many times", async () => {
    const { container } = containerReading({ completed_at: new Date(), order: null })

    await expect(completePaidCart(container, { ...verdict, attempts: 5 })).rejects.toMatchObject({
      safeMessage: "payments.completed_cart_without_order",
    })
    expect(alertPaymentIssue).toHaveBeenCalledWith(
      container,
      expect.objectContaining({ issue: "completion_stuck", cart_id: "cart_01" })
    )
  })

  it("tries again when the cart cannot be read: never a refund", async () => {
    const { container } = containerReading(new Error("connection reset"))

    await expect(completePaidCart(container, verdict)).rejects.toThrow("connection reset")
    expect(completeRun).not.toHaveBeenCalled()
  })

  it("still gives back a paid cart its own rules refuse while no order exists", async () => {
    const { container, graph } = containerReading(notOrdered)
    completeRun.mockResolvedValue(refused)

    const result = await completePaidCart(container, verdict)

    expect(result).toEqual({ order_id: null, will_fail_again: true })
    // Read before the completion, after it, and once more before the refund
    expect(graph).toHaveBeenCalledTimes(3)
  })

  it("places the order of a cart not yet one", async () => {
    const { container } = containerReading(notOrdered)
    completeRun.mockResolvedValue({ result: { id: "order_02" }, errors: [] })

    expect(await completePaidCart(container, verdict)).toEqual({
      order_id: "order_02",
      will_fail_again: false,
    })
    expect(markStockShortFromShelf).not.toHaveBeenCalled()
  })
})

describe("completePaidCart tells the shop only of a completion that keeps failing (review Z1)", () => {
  // The shelf refuses the cart; its backorder fails on a lock, a passing fault
  const stockShort = {
    errors: [{ error: { message: "Not enough stock available for item x at location y" } }],
  }
  const lockBusy = { errors: [{ error: { message: "Timed-out acquiring lock: cart_01" } }] }

  it.each([
    ["the backorder fails on a lock", true],
    ["the completion fails on a lock", false],
  ])("below the threshold, %s: tried again, no alert", async (_, short) => {
    const { container } = containerReading(notOrdered)
    completeRun.mockResolvedValue(short ? stockShort : lockBusy)
    backorderRun.mockResolvedValue(lockBusy)

    await expect(
      completePaidCart(container, { ...verdict, attempts: STUCK_ATTEMPTS - 1 })
    ).rejects.toMatchObject({ safeMessage: "payments.completion_failed" })
    expect(backorderRun).toHaveBeenCalledTimes(short ? 1 : 0)
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })

  it.each([
    ["the backorder fails on a lock", true],
    ["the completion fails on a lock", false],
  ])("at the threshold, %s: tried again, the shop told", async (_, short) => {
    const { container } = containerReading(notOrdered)
    completeRun.mockResolvedValue(short ? stockShort : lockBusy)
    backorderRun.mockResolvedValue(lockBusy)

    await expect(
      completePaidCart(container, { ...verdict, attempts: STUCK_ATTEMPTS })
    ).rejects.toMatchObject({ safeMessage: "payments.completion_failed" })
    expect(alertPaymentIssue).toHaveBeenCalledTimes(1)
    expect(alertPaymentIssue).toHaveBeenCalledWith(container, {
      issue: "completion_stuck",
      provider: "paytr",
      reference: verdict.reference,
      cart_id: "cart_01",
      amount: 21000,
    })
  })

  it("a verdict without a count (none kept) never alerts on its own", async () => {
    const { container } = containerReading(notOrdered)
    completeRun.mockResolvedValue(stockShort)
    backorderRun.mockResolvedValue(lockBusy)
    const uncounted: Parameters<typeof completePaidCart>[1] = { ...verdict }
    delete uncounted.attempts

    await expect(completePaidCart(container, uncounted)).rejects.toMatchObject({
      safeMessage: "payments.completion_failed",
    })
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })

  it("places a stock-short cart as a backorder at once, with no alert", async () => {
    const { container } = containerReading(notOrdered)
    completeRun.mockResolvedValue(stockShort)
    backorderRun.mockResolvedValue({ result: { order_id: "order_03" }, errors: [] })

    expect(await completePaidCart(container, { ...verdict, attempts: STUCK_ATTEMPTS })).toEqual({
      order_id: "order_03",
      will_fail_again: false,
    })
    expect(alertPaymentIssue).not.toHaveBeenCalled()
  })
})
