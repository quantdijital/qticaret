import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  clearedMetadata,
  keepReservedMetadata,
  metadataTarget,
  refuseReservedMetadata,
} from "../cart-metadata"

describe("metadataTarget", () => {
  it("names the cart, or the cart and line, of a cart's own routes only", () => {
    expect(metadataTarget("/store/carts/cart_1")).toEqual({ cartId: "cart_1" })
    expect(metadataTarget("/store/carts/cart_1?fields=id")).toEqual({ cartId: "cart_1" })
    expect(metadataTarget("/store/carts/cart_1/line-items/cali_1")).toEqual({
      cartId: "cart_1",
      lineId: "cali_1",
    })
    expect(metadataTarget("/store/carts/cart_1/complete")).toBeNull()
    expect(metadataTarget("/store/carts/cart_1/line-items")).toBeNull()
    expect(metadataTarget("/store/carts")).toBeNull()
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

  async function kept(url: string, body: Record<string, unknown>, validatedBody?: object) {
    const next = jest.fn<undefined, [unknown?]>()
    await keepReservedMetadata(
      {
        method: "POST",
        originalUrl: url,
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

    expect(await kept("/store/carts/cart_1", body, validated)).toBeUndefined()
    expect(body).toEqual({ metadata: { foo: "" }, email: "a@b.test" })
    expect(validated).toEqual({ metadata: { foo: "" } })
  })

  it("drops a line's null when the line has only the server's keys", async () => {
    listLineItems.mockResolvedValue([{ id: "cali_1", metadata: { qt_addons: [] } }])
    const body: Record<string, unknown> = { quantity: 2, metadata: null }

    await kept("/store/carts/cart_1/line-items/cali_1", body)

    expect(listLineItems).toHaveBeenCalledWith(
      { id: "cali_1", cart_id: "cart_1" },
      expect.anything()
    )
    expect(body).toEqual({ quantity: 2 })
  })

  it("leaves a null as is where nothing is the server's, and other bodies unread", async () => {
    listCarts.mockResolvedValue([{ id: "cart_1", metadata: { foo: 1 } }])
    const plain = { metadata: null }
    await kept("/store/carts/cart_1", plain)
    expect(plain).toEqual({ metadata: null })

    const own = { metadata: {} }
    await kept("/store/carts/cart_1", own)
    await kept("/store/carts/cart_1/complete", { metadata: null })
    expect(own).toEqual({ metadata: {} })
    expect(listCarts).toHaveBeenCalledTimes(1)
  })
})
