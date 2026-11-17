import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { lineAvailableUnits } from "../../../workflows/stock/line-stock"
import { cartLineAskOf, insufficientStockError } from "../cart-line-stock"
import { platformErrorHandler } from "../error-handler"
import { fakeResponse } from "./fakes"

jest.mock("../../../workflows/stock/line-stock", () => ({ lineAvailableUnits: jest.fn() }))
const units = lineAvailableUnits as jest.MockedFunction<typeof lineAvailableUnits>

const CART = "cart_01JABCDEFGHJKMNPQRSTVWXYZ"
const LINE = "cali_01JABCDEFGHJKMNPQRSTVWXYZ"
const VARIANT = "variant_01JABCDEFGHJKMNPQRSTVWX"

// What Medusa 2.21.2's confirmInventoryStep throws, and the plain object a workflow run hands back
const SHORT = new MedusaError(
  MedusaError.Types.NOT_ALLOWED,
  "Some variant does not have the required inventory",
  MedusaError.Codes.INSUFFICIENT_INVENTORY
)
const SHORT_PLAIN = { type: "not_allowed", message: SHORT.message }

const requestOf = (path: string, body: unknown = {}, method = "POST") =>
  ({
    path,
    originalUrl: path,
    method,
    body,
    validatedBody: body,
    requestId: "req-12345678",
    scope: { resolve: jest.fn() },
  }) as unknown as MedusaRequest

const ADD = `/store/carts/${CART}/line-items`
const CHANGE = `/store/carts/${CART}/line-items/${LINE}`

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
  units.mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("cartLineAskOf", () => {
  it("reads the line asked for from Medusa's stock refusal on the store line routes", () => {
    expect(cartLineAskOf(SHORT, requestOf(ADD, { variant_id: VARIANT, quantity: 5 }))).toEqual({
      cartId: CART,
      lineId: null,
      variantId: VARIANT,
    })
    expect(cartLineAskOf(SHORT_PLAIN, requestOf(CHANGE, { quantity: 2 }))).toEqual({
      cartId: CART,
      lineId: LINE,
      variantId: null,
    })
    // A variant id that is not one is not looked up
    expect(cartLineAskOf(SHORT, requestOf(ADD, { variant_id: "x'; --" }))?.variantId).toBeNull()
  })

  it("leaves every other error, route and method as the handler answers them today", () => {
    const others: [unknown, MedusaRequest][] = [
      [new MedusaError(MedusaError.Types.NOT_ALLOWED, "Cart is completed"), requestOf(ADD)],
      [new MedusaError(MedusaError.Types.INVALID_DATA, SHORT.message), requestOf(ADD)],
      [new ValidationError("addons.max_quantity"), requestOf(CHANGE)],
      [SHORT, requestOf(`/store/carts/${CART}/line-items/${LINE}/addons`)],
      [SHORT, requestOf(`/store/carts/${CART}/complete`)],
      [SHORT, requestOf(`/admin/orders/order_1/edits`)],
      [SHORT, requestOf(CHANGE, {}, "DELETE")],
      [
        { type: "not_allowed", message: "Not enough stock available for item x at location y" },
        requestOf(ADD),
      ],
    ]
    for (const [error, req] of others) {
      expect(cartLineAskOf(error, req)).toBeNull()
    }
  })
})

describe("insufficientStockError", () => {
  const ask = { cartId: CART, lineId: LINE, variantId: null }

  it("names the units for sale when they are few", async () => {
    units.mockResolvedValue(1)
    expect(await insufficientStockError({ resolve: jest.fn() }, ask)).toMatchObject({
      safeMessage: "cart.insufficient_stock",
      values: { available: "1" },
    })
    units.mockResolvedValue(10)
    expect((await insufficientStockError({ resolve: jest.fn() }, ask)).values).toEqual({
      available: "10",
    })
  })

  it("says only the sentence for many units, none, an untracked variant or a failed read", async () => {
    for (const answer of [11, 0, null]) {
      units.mockResolvedValue(answer)
      const refusal = await insufficientStockError({ resolve: jest.fn() }, ask)
      expect(refusal.safeMessage).toBe("cart.insufficient_stock")
      expect(refusal.values).toBeUndefined()
    }
    units.mockRejectedValue(new Error("database gone"))
    expect((await insufficientStockError({ resolve: jest.fn() }, ask)).values).toBeUndefined()
  })
})

describe("platformErrorHandler on a store line route", () => {
  const settled = () => new Promise((resolve) => setImmediate(resolve))

  it("answers Medusa's stock refusal with cart.insufficient_stock and the count", async () => {
    units.mockResolvedValue(3)
    const response = fakeResponse()
    platformErrorHandler(SHORT, requestOf(ADD, { variant_id: VARIANT }), response.res, jest.fn())
    await settled()
    expect(response.status()).toBe(400)
    expect(response.body()).toEqual({
      type: "invalid_data",
      message: "cart.insufficient_stock",
      values: { available: "3" },
      request_id: "req-12345678",
    })
  })

  it("answers any other error there as before, at once", () => {
    const response = fakeResponse()
    const closed = new MedusaError(MedusaError.Types.NOT_ALLOWED, "Cart is completed")
    platformErrorHandler(closed, requestOf(CHANGE, { quantity: 2 }), response.res, jest.fn())
    expect(units).not.toHaveBeenCalled()
    expect(response.status()).toBe(400)
    expect(response.body()).toMatchObject({ type: "not_allowed", message: "Cart is completed" })
  })
})
