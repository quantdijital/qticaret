import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
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

function exchange(method = "POST", status = 200) {
  const sent: unknown[] = []
  const req = {
    method,
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
  return { req, res, next, sent }
}

/** Waits for the answer the wrapped `res.json` sends once its work is done. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  jest.clearAllMocks()
  workflow.mockReturnValue({ run })
  run.mockResolvedValue({ result: { cart_id: "cart_1" } })
  graph.mockResolvedValue({ data: [{ id: "cart_1", items: [{ unit_price: 80 }] }] })
})

/** ADR-0068 §7: a guest's cart a wholesaler takes is priced at wholesale at once. */
describe("repriceWholesaleTransfer", () => {
  it("prices the session's cart again for a wholesaler and answers it as it is now", async () => {
    shopper.mockResolvedValue(WHOLESALER)
    const { res, next, sent } = exchange()
    expect(next).toHaveBeenCalledWith()
    res.json(STALE)
    await settled()
    expect(shopper).toHaveBeenCalledWith(expect.anything(), "cus_session")
    expect(run).toHaveBeenCalledWith({ input: { cart_id: "cart_1" } })
    expect(sent).toEqual([{ cart: { id: "cart_1", items: [{ unit_price: 80 }] } }])
  })

  it("leaves anyone else's answer, and a refused transfer, as Medusa gave it", async () => {
    shopper.mockResolvedValue(RETAIL)
    const retail = exchange()
    retail.res.json(STALE)
    await settled()
    expect(retail.sent).toEqual([STALE])
    const refused = exchange("POST", 403)
    refused.res.json({ message: "nope" })
    await settled()
    expect(refused.sent).toEqual([{ message: "nope" }])
    expect(run).not.toHaveBeenCalled()
  })

  it("answers as Medusa did when the reprice fails", async () => {
    shopper.mockResolvedValue(WHOLESALER)
    run.mockRejectedValue(new Error("locked"))
    const { res, sent } = exchange()
    res.json(STALE)
    await settled()
    expect(sent).toEqual([STALE])
  })

  it("lets any other method through untouched", () => {
    const { req, next } = exchange("GET")
    expect(next).toHaveBeenCalledWith()
    expect(shopper).not.toHaveBeenCalled()
    expect(req).toBeDefined()
  })
})
