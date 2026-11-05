import { beforeEach, describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"
import type { Cart, CartLine } from "@/lib/cart/cart"
import type { CheckoutCart } from "@/lib/checkout/cart"
import type { StoreOrder } from "@/lib/orders/order"
import { StoreApiError } from "@/lib/store-api/errors"

const server = vi.hoisted(() => ({ storePublicGet: vi.fn() }))
vi.mock("@/lib/store-api/server", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  storePublicGet: server.storePublicGet,
}))
const requests = vi.hoisted(() => ({ pathsOf: vi.fn() }))
vi.mock("@/lib/store-api/requests", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pathsOf: requests.pathsOf,
}))

const { linePathOf, productPathsOf } = await import("../line-paths")
const { cartLinesOf, miniCartOf } = await import("../cart")
const { summaryOf } = await import("../checkout")
const { orderView } = await import("../order")

/**
 * A bought line links to its product's page (2026-11-05): the cart, the
 * drawer, the checkout's summary and the order. The path is the URL
 * registry's, the line's variant chosen; a product the shop no longer
 * shows (gone, unpublished, out of its channel) reads as text.
 */

const KNIFE = "/urun/kalem-ucu-caki"
const PATHS: ReadonlyMap<string, string> = new Map([["prod_knife", KNIFE]])

const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: "cali_1",
  title: "Kalem Ucu Çakı",
  subtitle: null,
  variant_title: "Kiremit",
  thumbnail: null,
  quantity: 1,
  unit_price: 449,
  total: 449,
  original_total: 449,
  product_id: "prod_knife",
  variant_id: "variant_kiremit",
  metadata: null,
  ...over,
})

describe("a line's product page", () => {
  it("is the registry's path with the line's variant chosen", () => {
    expect(linePathOf(PATHS, line())).toBe(`${KNIFE}?variant=variant_kiremit`)
    expect(linePathOf(PATHS, line({ variant_id: null }))).toBe(KNIFE)
    expect(linePathOf(new Map([["prod_knife", "/x?y=1"]]), line())).toBe(
      "/x?y=1&variant=variant_kiremit"
    )
  })

  it("is none for a product without a shown path", () => {
    expect(linePathOf(PATHS, line({ product_id: "prod_gone" }))).toBeNull()
    expect(linePathOf(PATHS, line({ product_id: null }))).toBeNull()
  })
})

describe("the product pages lines may link to", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps only products the Store API still lists, with their registry paths", async () => {
    server.storePublicGet.mockResolvedValue({ products: [{ id: "prod_knife" }] })
    requests.pathsOf.mockResolvedValue({ prod_knife: KNIFE, prod_draft: "/urun/taslak" })
    const paths = await productPathsOf([
      { product_id: "prod_knife" },
      { product_id: "prod_draft" },
      { product_id: "prod_knife" },
      { product_id: null },
    ])
    expect([...paths]).toEqual([["prod_knife", KNIFE]])
    expect(server.storePublicGet).toHaveBeenCalledWith("/store/products", {
      id: ["prod_knife", "prod_draft"],
      fields: "id",
      limit: 2,
    })
    expect(requests.pathsOf).toHaveBeenCalledWith("product", ["prod_knife", "prod_draft"])
  })

  it("asks nothing for lines without products, and gives none when the backend refuses", async () => {
    expect((await productPathsOf([])).size).toBe(0)
    expect(server.storePublicGet).not.toHaveBeenCalled()
    server.storePublicGet.mockRejectedValue(new StoreApiError(503, null, null))
    requests.pathsOf.mockResolvedValue({ prod_knife: KNIFE })
    expect((await productPathsOf([line()])).size).toBe(0)
  })
})

describe("the lines' views", () => {
  const cart: Cart = {
    id: "cart_1",
    currency_code: "try",
    original_item_total: 898,
    item_total: 898,
    total: 898,
    completed_at: null,
    items: [line(), line({ id: "cali_2", product_id: "prod_gone" })],
    promotions: [],
  }

  it("give the cart's and the drawer's lines their pages, a gone product none", () => {
    expect(cartLinesOf(cart, PATHS).map((each) => each.path)).toEqual([
      `${KNIFE}?variant=variant_kiremit`,
      null,
    ])
    expect(miniCartOf(cart, null, t, PATHS)?.lines[0]?.path).toBe(
      `${KNIFE}?variant=variant_kiremit`
    )
    expect(cartLinesOf(cart)[0]?.path).toBeNull()
  })

  it("give the checkout's summary its lines' pages", () => {
    const checkout = {
      ...cart,
      email: null,
      shipping_address: null,
      shipping_methods: [],
      shipping_total: 0,
    } as CheckoutCart
    expect(summaryOf(checkout, t, PATHS).lines.map((each) => each.path)).toEqual([
      `${KNIFE}?variant=variant_kiremit`,
      null,
    ])
  })

  it("give the order's lines their pages while the shop shows the product", () => {
    const order = {
      id: "order_1",
      display_id: 1001,
      email: "ayse@example.com",
      created_at: "2026-11-05T10:00:00.000Z",
      status: "pending",
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
      items: cart.items,
      original_item_total: 898,
      item_total: 898,
      shipping_total: 0,
      total: 898,
      shipping_address: null,
    } as StoreOrder
    const extras = {
      token: null,
      contracts: [],
      returns: [],
      returnable: null,
      shipments: [],
      invoice: null,
      note: null,
    }
    expect(
      orderView(order, null, false, t, { ...extras, paths: PATHS }).lines.map((each) => each.path)
    ).toEqual([`${KNIFE}?variant=variant_kiremit`, null])
    expect(orderView(order, null, false, t, extras).lines[0]?.path).toBeNull()
  })
})
