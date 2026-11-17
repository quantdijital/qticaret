import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WHOLESALE_STORE_ROUTES } from "../../../../../http/wholesale-store-routes"
import { optionalCustomer, orderAccess } from "../../../../../http/order-access"
import { GET } from "../route"
import { StoreGetOrderWholesale } from "../validators"

jest.mock("../../../../../../workflows/wholesale/orders", () => ({
  isWholesaleOrder: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isWholesaleOrder } = require("../../../../../../workflows/wholesale/orders") as {
  isWholesaleOrder: jest.Mock
}

function call(access: object | undefined, params = { id: "order_1" }) {
  const headers: Record<string, string> = {}
  const sent: unknown[] = []
  const req = { params, scope: {}, order_access: access } as unknown as MedusaRequest
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name] = value
    },
    json: (body: unknown) => {
      sent.push(body)
    },
  } as unknown as MedusaResponse
  return { run: () => GET(req, res), headers, sent }
}

/** ADR-0068 slice 5 review L2: the order page's purchase event asks the order. */
describe("GET /store/orders/:id/wholesale", () => {
  beforeEach(() => {
    isWholesaleOrder.mockReset()
  })

  it("answers a yes or no for the order its access opened, kept by nobody on the way", async () => {
    isWholesaleOrder.mockResolvedValue(true)
    const { run, headers, sent } = call({ order_id: "order_1", customer_id: null, by: "token" })

    await run()

    expect(isWholesaleOrder).toHaveBeenCalledWith({}, "order_1")
    expect(sent).toEqual([{ wholesale: true }])
    expect(headers["Cache-Control"]).toBe("private, no-store")
  })

  it("reads the order the access granted, never the path's on its own", async () => {
    isWholesaleOrder.mockResolvedValue(false)
    const { run, sent } = call(
      { order_id: "order_own", customer_id: "cus_1", by: "customer" },
      {
        id: "order_other",
      }
    )

    await run()

    expect(isWholesaleOrder).toHaveBeenCalledWith({}, "order_own")
    expect(sent).toEqual([{ wholesale: false }])
  })

  it("does not answer at all without the order's access", async () => {
    await expect(call(undefined).run()).rejects.toThrow("order route without orderAccess")
    expect(isWholesaleOrder).not.toHaveBeenCalled()
  })

  it("sits behind the order page's access: its customer or its key, nobody else", () => {
    const route = WHOLESALE_STORE_ROUTES.find(
      (each) => each.matcher === "/store/orders/:id/wholesale"
    )
    expect(route?.methods).toEqual(["GET"])
    expect(route?.middlewares.slice(0, 2)).toEqual([optionalCustomer, orderAccess])
  })

  it("takes no query", () => {
    expect(StoreGetOrderWholesale.safeParse({}).success).toBe(true)
    expect(StoreGetOrderWholesale.safeParse({ customer_id: "cus_2" }).success).toBe(false)
  })
})
