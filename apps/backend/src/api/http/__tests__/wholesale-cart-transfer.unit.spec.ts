import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { repriceCartWorkflow } from "../../../workflows/wholesale/steps/carts"
import { wholesaleShopper } from "../../../workflows/wholesale/shopper"
import { repriceWholesaleTransfer } from "../wholesale-cart-transfer"

jest.mock("../../../workflows/wholesale/shopper", () => ({ wholesaleShopper: jest.fn() }))
jest.mock("../../../workflows/wholesale/steps/carts", () => ({ repriceCartWorkflow: jest.fn() }))

const shopper = wholesaleShopper as jest.MockedFunction<typeof wholesaleShopper>
const workflow = repriceCartWorkflow as unknown as jest.Mock
const run = jest.fn()
const graph = jest.fn()

const WHOLESALER = { active: true, vat_exclusive: true, min_quantity: null }
const RETAIL = { active: false, vat_exclusive: false, min_quantity: null }
const STALE = { cart: { id: "cart_1", items: [{ unit_price: 100 }] } }
const FRESH = { id: "cart_1", items: [{ unit_price: 80 }] }
const OWN_OPEN = { customer_id: "cus_session", completed_at: null, metadata: null }

/** The cart as the query reads it: its owner and state, or the answer's fields. */
function cartIs(owner: Record<string, unknown>) {
  graph.mockImplementation((config: { fields: string[] }) =>
    Promise.resolve({ data: [config.fields.includes("customer_id") ? owner : FRESH] })
  )
}

function exchange(method = "POST", status = 200) {
  const sent: unknown[] = []
  const req = {
    method,
    requestId: "req_transfer_1",
    params: { id: "cart_1" },
    auth_context: { actor_type: "customer", actor_id: "cus_session" },
    queryConfig: { fields: ["id", "items.unit_price"] },
    scope: { resolve: (key: string) => (key === ContainerRegistrationKeys.QUERY ? { graph } : {}) },
  } as unknown as MedusaRequest
  const res = {
    statusCode: status,
    json: (body: unknown) => {
      sent.push(body)
      return res
    },
  } as unknown as MedusaResponse
  const next = jest.fn()
  repriceWholesaleTransfer(req, res, next)
  return { res, next, sent }
}

/** Waits for the answer the wrapped `res.json` sends once its work is done. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

async function answered(status = 200) {
  const { res, sent } = exchange("POST", status)
  res.json(STALE)
  await settled()
  return sent
}

beforeEach(() => {
  jest.clearAllMocks()
  workflow.mockReturnValue({ run })
  run.mockResolvedValue({ result: { cart_id: "cart_1" } })
  shopper.mockResolvedValue(WHOLESALER)
  cartIs(OWN_OPEN)
})

/** ADR-0068 §7: a guest's cart a wholesaler takes is priced at wholesale at once. */
describe("repriceWholesaleTransfer", () => {
  it("prices the session's own open cart again for a wholesaler and answers it as it is now", async () => {
    expect(await answered()).toEqual([{ cart: FRESH }])
    expect(shopper).toHaveBeenCalledWith(expect.anything(), "cus_session")
    expect(run).toHaveBeenCalledWith({ input: { cart_id: "cart_1" } })
  })

  it("leaves anyone else's answer, and a refused transfer, as Medusa gave it", async () => {
    shopper.mockResolvedValue(RETAIL)
    expect(await answered()).toEqual([STALE])
    shopper.mockResolvedValue(WHOLESALER)
    expect(await answered(403)).toEqual([STALE])
    expect(run).not.toHaveBeenCalled()
  })

  it("never prices another customer's, a completed or a payment link's cart (review M1)", async () => {
    for (const owner of [
      { ...OWN_OPEN, customer_id: "cus_other" },
      { ...OWN_OPEN, customer_id: null },
      { ...OWN_OPEN, completed_at: "2026-11-15T10:00:00.000Z" },
      { ...OWN_OPEN, metadata: { qt_payment_link: "plink_1" } },
    ]) {
      cartIs(owner)
      expect(await answered()).toEqual([STALE])
    }
    expect(run).not.toHaveBeenCalled()
  })

  it("tries once more, then answers as Medusa did, logging the request's id only (review L5)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
    run.mockRejectedValueOnce(new Error("locked"))
    expect(await answered()).toEqual([{ cart: FRESH }])
    expect(run).toHaveBeenCalledTimes(2)

    run.mockReset()
    run.mockRejectedValue(new Error("locked"))
    expect(await answered()).toEqual([STALE])
    expect(run).toHaveBeenCalledTimes(2)
    const logged = JSON.stringify(warn.mock.calls)
    expect(logged).toContain("req_transfer_1")
    expect(logged).not.toMatch(/cart_1|cus_session/)
    warn.mockRestore()
  })

  it("lets any other method through untouched", () => {
    const { next, sent } = exchange("GET")
    expect(next).toHaveBeenCalledWith()
    expect(sent).toEqual([])
    expect(shopper).not.toHaveBeenCalled()
  })
})
