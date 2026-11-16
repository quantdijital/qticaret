import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import { assertWholesaleCartCompletes, checkWholesaleCartForPayment } from "../checkout"
import { NOT_WHOLESALE, wholesaleShopper } from "../shopper"
import { repriceCartWorkflow } from "../steps/carts"

jest.mock("../shopper", () => ({
  ...jest.requireActual<Record<string, unknown>>("../shopper"),
  wholesaleShopper: jest.fn(),
}))
jest.mock("../steps/carts", () => ({ repriceCartWorkflow: jest.fn() }))

const shopper = wholesaleShopper as jest.MockedFunction<typeof wholesaleShopper>
const reprice = repriceCartWorkflow as unknown as jest.Mock

const ACTIVE = { active: true, vat_exclusive: true, min_quantity: null }

interface Cart {
  id: string
  customer_id: string | null
  completed_at?: string | null
  metadata?: Record<string, unknown> | null
  total: number
  items: Record<string, unknown>[]
  promotions?: { code: string; is_automatic: boolean }[]
}

/** A cart of one wholesale line at 80.00, the customer's price now `priceNow` (per unit). */
function cartOf(fields: Partial<Cart> = {}): Cart {
  return {
    id: "cart_1",
    customer_id: "cus_1",
    completed_at: null,
    metadata: null,
    total: 160,
    items: [{ id: "item_1", variant_id: "variant_1", quantity: 2, unit_price: 80 }],
    promotions: [],
    ...fields,
  }
}

function container(reads: Cart[], options: { priceNow?: number; everWholesale?: boolean } = {}) {
  let read = 0
  const graph = jest.fn((config: { entity: string }) => {
    if (config.entity === "cart") {
      const cart = reads[Math.min(read, reads.length - 1)]
      read += 1
      return Promise.resolve({ data: cart ? [cart] : [] })
    }
    return Promise.resolve({
      data: [{ id: "variant_1", calculated_price: { calculated_amount: options.priceNow ?? 80 } }],
    })
  })
  const listWholesaleAccounts = jest.fn(() =>
    Promise.resolve(options.everWholesale === false ? [] : [{ id: "wacc_1" }])
  )
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph },
    [WHOLESALE_MODULE]: { listWholesaleAccounts },
  }
  return {
    scope: { resolve: (key: string) => services[key] } as unknown as MedusaContainer,
    graph,
    listWholesaleAccounts,
  }
}

const run = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  shopper.mockResolvedValue(ACTIVE)
  run.mockResolvedValue({ result: { cart_id: "cart_1" } })
  reprice.mockReturnValue({ run })
})

/** ADR-0068 slice 4: the order's completion, reads only. */
describe("assertWholesaleCartCompletes", () => {
  it("lets a wholesaler's cart at its prices now through", async () => {
    const { scope } = container([cartOf()])
    await expect(assertWholesaleCartCompletes(scope, "cart_1")).resolves.toBeUndefined()
  })

  it("refuses a cart priced before its customer's prices changed (review M1)", async () => {
    // Closed since: retail now, the cart still at wholesale
    shopper.mockResolvedValue(NOT_WHOLESALE)
    const { scope } = container([cartOf()], { priceNow: 100 })
    await expect(assertWholesaleCartCompletes(scope, "cart_1")).rejects.toMatchObject({
      name: "ConflictError",
      safeMessage: "wholesale.prices_changed",
    })
  })

  it("refuses a wholesaler's cart with a code, then one short of its minimum", async () => {
    const coded = container([cartOf({ promotions: [{ code: "YAZ10", is_automatic: false }] })])
    await expect(assertWholesaleCartCompletes(coded.scope, "cart_1")).rejects.toMatchObject({
      safeMessage: "promotions.wholesale_no_code",
    })
    shopper.mockResolvedValue({ ...ACTIVE, min_quantity: 5 })
    const short = container([cartOf()])
    await expect(assertWholesaleCartCompletes(short.scope, "cart_1")).rejects.toMatchObject({
      name: "ValidationError",
      safeMessage: "wholesale.min_quantity",
      field: "items",
      values: { min: "5", units: "2" },
    })
  })

  it("refuses a wholesaler's cart still carrying an automatic campaign (§6)", async () => {
    const { scope } = container([cartOf({ promotions: [{ code: "KIS", is_automatic: true }] })])
    await expect(assertWholesaleCartCompletes(scope, "cart_1")).rejects.toMatchObject({
      safeMessage: "wholesale.prices_changed",
    })
  })

  it("never judges a guest's, a payment link's, a never-wholesaler's or an ordered cart", async () => {
    shopper.mockResolvedValue(NOT_WHOLESALE)
    for (const { scope } of [
      container([cartOf({ customer_id: null })], { priceNow: 100 }),
      container([cartOf({ metadata: { qt_payment_link: "plink_1" } })], { priceNow: 100 }),
      container([cartOf()], { priceNow: 100, everWholesale: false }),
      container([cartOf({ completed_at: "2026-11-16T10:00:00Z" })], { priceNow: 100 }),
      container([]),
    ]) {
      await expect(assertWholesaleCartCompletes(scope, "cart_1")).resolves.toBeUndefined()
    }
  })

  it("reads the customer's own prices: their groups, the line's quantity", async () => {
    const cart: Cart = {
      ...cartOf(),
      ...{ customer: { groups: [{ id: "cusgroup_tier" }] }, region_id: "reg_1" },
    }
    const { scope, graph } = container([cart])
    await assertWholesaleCartCompletes(scope, "cart_1")
    const priced = graph.mock.calls.find(([config]) => config.entity === "product_variant")?.[0]
    expect(JSON.stringify(priced)).toContain('"quantity":2')
    expect(JSON.stringify(priced)).toContain('"groups":{"id":["cusgroup_tier"]}')
  })
})

/** ADR-0068 slice 4: before a payment starts, the cart priced again when it must be. */
describe("checkWholesaleCartForPayment", () => {
  it("leaves a cart at its prices now, and never prices one it does not judge", async () => {
    const { scope } = container([cartOf()])
    await expect(checkWholesaleCartForPayment(scope, "cart_1")).resolves.toEqual({
      repriced: false,
    })
    shopper.mockResolvedValue(NOT_WHOLESALE)
    const retail = container([cartOf()], { priceNow: 100, everWholesale: false })
    await checkWholesaleCartForPayment(retail.scope, "cart_1")
    expect(run).not.toHaveBeenCalled()
  })

  it("prices a stale cart again and stops the start for the shopper to see it", async () => {
    shopper.mockResolvedValue(NOT_WHOLESALE)
    const after = cartOf({
      total: 200,
      items: [{ id: "item_1", variant_id: "variant_1", quantity: 2, unit_price: 100 }],
    })
    const { scope } = container([cartOf(), after], { priceNow: 100 })
    await expect(checkWholesaleCartForPayment(scope, "cart_1")).rejects.toMatchObject({
      name: "ConflictError",
      safeMessage: "wholesale.prices_changed",
    })
    expect(run).toHaveBeenCalledWith({ input: { cart_id: "cart_1" } })
  })

  it("takes an automatic campaign off a wholesaler's cart before paying", async () => {
    const before = cartOf({ total: 150, promotions: [{ code: "KIS", is_automatic: true }] })
    const { scope } = container([before, cartOf()])
    await expect(checkWholesaleCartForPayment(scope, "cart_1")).rejects.toMatchObject({
      safeMessage: "wholesale.prices_changed",
    })
  })

  it("lets the start go on when Medusa's refresh changes nothing (logged)", async () => {
    const { scope } = container([cartOf()], { priceNow: 79 })
    await expect(checkWholesaleCartForPayment(scope, "cart_1")).resolves.toEqual({
      repriced: true,
    })
  })

  it("refuses a wholesaler's cart short of its minimum before pricing anything", async () => {
    shopper.mockResolvedValue({ ...ACTIVE, min_quantity: 3 })
    const { scope } = container([cartOf()], { priceNow: 100 })
    await expect(checkWholesaleCartForPayment(scope, "cart_1")).rejects.toMatchObject({
      safeMessage: "wholesale.min_quantity",
    })
    expect(run).not.toHaveBeenCalled()
  })
})
