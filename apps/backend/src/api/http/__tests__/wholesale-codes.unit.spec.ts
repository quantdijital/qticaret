import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { wholesaleShopper } from "../../../workflows/wholesale/shopper"
import { refuseWholesaleCodes } from "../wholesale-codes"

jest.mock("../../../workflows/wholesale/shopper", () => ({ wholesaleShopper: jest.fn() }))
jest.mock("@medusajs/framework/http", () => ({
  ...jest.requireActual<Record<string, unknown>>("@medusajs/framework/http"),
  // The session reads as the request's own `auth_context` (set by each test)
  authenticate: () => (_req: unknown, _res: unknown, next: () => void) => {
    next()
  },
}))

const shopper = wholesaleShopper as jest.MockedFunction<typeof wholesaleShopper>
const graph = jest.fn()

const WHOLESALER = { active: true, vat_exclusive: true, min_quantity: null }
const RETAIL = { active: false, vat_exclusive: false, min_quantity: null }

function cartIs(cart: Record<string, unknown> | null) {
  graph.mockResolvedValue({ data: cart ? [cart] : [] })
}

async function send(
  method: string,
  url: string,
  body: Record<string, unknown>,
  auth?: Record<string, unknown>
): Promise<unknown> {
  const req = {
    method,
    originalUrl: url,
    body,
    auth_context: auth,
    scope: { resolve: (key: string) => (key === ContainerRegistrationKeys.QUERY ? { graph } : {}) },
  } as unknown as MedusaRequest
  const next = jest.fn<undefined, [unknown?]>()
  await refuseWholesaleCodes(req, {} as MedusaResponse, next)
  expect(next).toHaveBeenCalledTimes(1)
  return next.mock.calls[0]?.[0]
}

const refused = expect.objectContaining({ safeMessage: "promotions.wholesale_no_code" }) as unknown

beforeEach(() => {
  jest.clearAllMocks()
  shopper.mockResolvedValue(WHOLESALER)
  cartIs({ customer_id: "cus_1", metadata: null })
})

/** ADR-0068 §6: a wholesaler's cart takes no discount code; the cart's customer decides. */
describe("refuseWholesaleCodes", () => {
  it("refuses a code added to, or set on, a wholesaler's cart", async () => {
    await expect(
      send("POST", "/store/carts/cart_1/promotions", { promo_codes: ["YAZ10"] })
    ).resolves.toEqual(refused)
    await expect(send("POST", "/store/carts/cart_1", { promo_codes: ["yaz10"] })).resolves.toEqual(
      refused
    )
    expect(shopper).toHaveBeenCalledWith(expect.anything(), "cus_1")
  })

  it("refuses a cart a wholesaler makes with a code, by the session's customer", async () => {
    await expect(
      send(
        "POST",
        "/store/carts",
        { promo_codes: ["YAZ10"] },
        {
          actor_type: "customer",
          actor_id: "cus_session",
        }
      )
    ).resolves.toEqual(refused)
    expect(shopper).toHaveBeenCalledWith(expect.anything(), "cus_session")
  })

  it("lets a code off, a request without codes and other cart routes through untouched", async () => {
    for (const [method, url, body] of [
      ["DELETE", "/store/carts/cart_1/promotions", { promo_codes: ["YAZ10"] }],
      ["POST", "/store/carts/cart_1", { email: "a@example.com" }],
      ["POST", "/store/carts/cart_1/promotions", { promo_codes: [] }],
      ["POST", "/store/carts/cart_1/line-items", { promo_codes: ["YAZ10"] }],
    ] as const) {
      await expect(send(method, url, body)).resolves.toBeUndefined()
    }
    expect(graph).not.toHaveBeenCalled()
  })

  it("leaves a retail customer's, a guest's and a payment link's cart to the code rules", async () => {
    shopper.mockResolvedValue(RETAIL)
    await expect(
      send("POST", "/store/carts/cart_1/promotions", { promo_codes: ["YAZ10"] })
    ).resolves.toBeUndefined()
    shopper.mockResolvedValue(WHOLESALER)
    for (const cart of [
      { customer_id: null, metadata: null },
      { customer_id: "cus_1", metadata: { qt_payment_link: "plink_1" } },
      null,
    ]) {
      cartIs(cart)
      await expect(
        send("POST", "/store/carts/cart_1/promotions", { promo_codes: ["YAZ10"] })
      ).resolves.toBeUndefined()
    }
    // A guest making a cart with a code
    await expect(send("POST", "/store/carts", { promo_codes: ["YAZ10"] })).resolves.toBeUndefined()
  })
})
