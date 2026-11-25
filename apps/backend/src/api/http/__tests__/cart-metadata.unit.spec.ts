import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  clearedMetadata,
  keepReservedMetadata,
  metadataTarget,
  refuseReservedMetadata,
} from "../cart-metadata"

describe("metadataTarget", () => {
  const cart = { id: "cart_1" }

  it("names the cart, or the cart and line, of a cart's own routes only", () => {
    expect(metadataTarget(cart, "/")).toEqual({ cartId: "cart_1" })
    expect(metadataTarget(cart, "")).toEqual({ cartId: "cart_1" })
    expect(metadataTarget({ id: "cart_1", line_id: "cali_1" }, "/")).toEqual({
      cartId: "cart_1",
      lineId: "cali_1",
    })
    // The cart's prefix-mounted matcher on a line's route
    expect(metadataTarget(cart, "/line-items/cali_1/")).toEqual({
      cartId: "cart_1",
      lineId: "cali_1",
    })
    expect(metadataTarget(cart, "/complete")).toBeNull()
    expect(metadataTarget(cart, "/line-items")).toBeNull()
    expect(metadataTarget({}, "/")).toBeNull()
  })

  it("reads the line as Express routes it: any case, percent-decoded", () => {
    expect(metadataTarget(cart, "/Line-Items/cali_%41BC")).toEqual({
      cartId: "cart_1",
      lineId: "cali_ABC",
    })
    expect(() => metadataTarget(cart, "/line-items/%E0%A4%A")).toThrow()
  })
})

describe("clearedMetadata", () => {
  it("removes the storefront's own keys one by one and sends nothing without them", () => {
    expect(clearedMetadata({ qt_sms_held: true, foo: 1, bar: "x" })).toEqual({ foo: "", bar: "" })
    expect(clearedMetadata({ qt_sms_held: true })).toBeUndefined()
    expect(clearedMetadata(null)).toBeUndefined()
  })
})

describe("refuseReservedMetadata", () => {
  const refused = (body: unknown, method = "POST") => {
    const next = jest.fn<undefined, [unknown?]>()
    refuseReservedMetadata({ method, body } as MedusaRequest, {} as MedusaResponse, next)
    return (next.mock.calls[0]?.[0] as { safeMessage?: string } | undefined)?.safeMessage
  }

  it("refuses `qt_` keys on a cart, its lines and its addresses, a removal too", () => {
    expect(refused({ metadata: { qt_x: 1 } })).toBe("cart.metadata_reserved")
    expect(refused({ metadata: { qt_sms_held: "" } })).toBe("cart.metadata_reserved")
    expect(refused({ items: [{ metadata: { qt_fee: 1 } }] })).toBe("cart.metadata_reserved")
    expect(refused({ shipping_address: { metadata: { qt_x: 1 } } })).toBe("cart.metadata_reserved")
    expect(refused({ billing_address: { metadata: { qt_x: 1 } } })).toBe("cart.metadata_reserved")
  })

  it("lets the storefront's own keys, null and other methods through", () => {
    expect(refused({ metadata: { foo: 1 }, shipping_address: { metadata: null } })).toBeUndefined()
    expect(refused({ metadata: null, items: [null] })).toBeUndefined()
    expect(refused({ metadata: { qt_x: 1 } }, "GET")).toBeUndefined()
  })
})

describe("keepReservedMetadata", () => {
  const listCarts = jest.fn()
  const listLineItems = jest.fn()

  async function kept(
    path: string,
    body: Record<string, unknown>,
    validatedBody?: object,
    params: Record<string, string> = { id: "cart_1" }
  ) {
    const next = jest.fn<undefined, [unknown?]>()
    await keepReservedMetadata(
      {
        method: "POST",
        params,
        path,
        body,
        validatedBody,
        scope: {
          resolve: (key: string) => (key === Modules.CART ? { listCarts, listLineItems } : {}),
        },
      } as unknown as MedusaRequest,
      {} as MedusaResponse,
      next
    )
    return next.mock.calls[0]?.[0]
  }

  beforeEach(() => {
    listCarts.mockReset()
    listLineItems.mockReset()
  })

  it("turns a cart's null into removing the storefront's own keys, in both bodies", async () => {
    listCarts.mockResolvedValue([{ id: "cart_1", metadata: { qt_sms_held: true, foo: 1 } }])
    const body = { metadata: null, email: "a@b.test" }
    const validated = { metadata: null }

    expect(await kept("/", body, validated)).toBeUndefined()
    expect(listCarts).toHaveBeenCalledWith({ id: "cart_1" }, expect.anything())
    expect(body).toEqual({ metadata: { foo: "" }, email: "a@b.test" })
    expect(validated).toEqual({ metadata: { foo: "" } })
  })

  it("drops a line's null when the line has only the server's keys", async () => {
    listLineItems.mockResolvedValue([{ id: "cali_1", metadata: { qt_addons: [] } }])
    const body: Record<string, unknown> = { quantity: 2, metadata: null }

    await kept("/", body, undefined, { id: "cart_1", line_id: "cali_1" })

    expect(listLineItems).toHaveBeenCalledWith(
      { id: "cali_1", cart_id: "cart_1" },
      expect.anything()
    )
    expect(body).toEqual({ quantity: 2 })
  })

  it("never lets a null on, even where nothing is the server's yet", async () => {
    listCarts.mockResolvedValue([{ id: "cart_1", metadata: { foo: 1 } }])
    const own = { metadata: null }
    await kept("/", own)
    expect(own).toEqual({ metadata: { foo: "" } })

    listCarts.mockResolvedValue([])
    const unknown: Record<string, unknown> = { metadata: null }
    await kept("/", unknown)
    expect(unknown).toEqual({})
  })

  it("reads a line under the cart's prefix route as Express routes it", async () => {
    listLineItems.mockResolvedValue([{ id: "cali_ABC", metadata: { qt_addons: [], foo: 1 } }])
    const body = { metadata: null }

    await kept("/LINE-ITEMS/cali_%41BC", body)

    expect(listLineItems).toHaveBeenCalledWith(
      { id: "cali_ABC", cart_id: "cart_1" },
      expect.anything()
    )
    expect(body).toEqual({ metadata: { foo: "" } })
  })

  it("passes a malformed line id on as an error, and leaves other bodies unread", async () => {
    expect(await kept("/line-items/%E0%A4%A", { metadata: null })).toBeInstanceOf(URIError)

    const own = { metadata: {} }
    await kept("/", own)
    const other = { metadata: null }
    await kept("/complete", other)
    expect(own).toEqual({ metadata: {} })
    expect(other).toEqual({ metadata: null })
    expect(listCarts).not.toHaveBeenCalled()
  })
})
