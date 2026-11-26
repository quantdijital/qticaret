import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { completeWithSystemPayment } from "../helpers/checkout"
import { shippedCart } from "../helpers/gift-cards"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface Cart {
  id: string
  items: { id: string; variant_id: string; quantity: number }[]
}

const CART_FIELDS = "id,items.id,items.variant_id,items.quantity"

/**
 * S5: a product's most per order (`max_quantity`), set by the shop and
 * held by the server as lines are added, raised and as the cart completes,
 * whatever the storefront sends.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let product: { productId: string; variantId: string }

    const adminPost = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const storePost = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: store.headers }))
    const setLimit = (limit: number | null) =>
      adminPost<{ max_quantity: number | null }>(`/admin/products/${product.productId}/catalog`, {
        max_quantity: limit,
      })
    const newCart = (quantity: number) =>
      storePost<{ cart: Cart }>(`/store/carts?fields=${CART_FIELDS}`, {
        region_id: shop.regionId,
        items: [{ variant_id: product.variantId, quantity }],
      })
    const add = (cartId: string, quantity: number) =>
      storePost<{ cart: Cart }>(`/store/carts/${cartId}/line-items?fields=${CART_FIELDS}`, {
        variant_id: product.variantId,
        quantity,
      })
    const change = (cartId: string, lineId: string, quantity: number) =>
      storePost<{ cart: Cart }>(
        `/store/carts/${cartId}/line-items/${lineId}?fields=${CART_FIELDS}`,
        { quantity }
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      shop = await stockShop(getContainer())
      product = await stockedProduct(getContainer(), shop, "sinirli-bicak", 50)
    })

    it("is set and cleared by the shop, a whole number from 1 to 9999", async () => {
      const set = await setLimit(2)
      expect([set.status, set.data.max_quantity]).toEqual([200, 2])
      for (const wrong of [0, -1, 1.5, 10_000]) {
        expect((await setLimit(wrong)).status).toBe(400)
      }
      const shown = await settle(
        http.get<{ product: { product_extension?: { max_quantity?: number | null } } }>(
          `/store/products/${product.productId}?region_id=${shop.regionId}&fields=%2Bproduct_extension.max_quantity`,
          { headers: store.headers }
        )
      )
      expect(shown.status).toBe(200)
      expect(shown.data.product.product_extension?.max_quantity).toBe(2)

      const cleared = await setLimit(null)
      expect([cleared.status, cleared.data.max_quantity]).toEqual([200, null])
      // No limit: any count the cart takes
      expect((await newCart(5)).status).toBe(200)
    })

    it("refuses a cart made or added to past the limit, counting what it holds", async () => {
      await setLimit(2)
      const tooMany = await newCart(3)
      expect([tooMany.status, tooMany.data.message]).toEqual([400, "cart.max_quantity"])

      const made = await newCart(1)
      expect(made.status).toBe(200)
      const cartId = made.data.cart.id
      // The same variant again merges into its line: 2 in all
      const second = await add(cartId, 1)
      expect(second.status).toBe(200)
      expect(second.data.cart.items.map((item) => item.quantity)).toEqual([2])
      const third = await add(cartId, 1)
      expect([third.status, third.data.message]).toEqual([400, "cart.max_quantity"])
    })

    it("refuses a line raised past the limit and always lets it be lowered", async () => {
      const made = await newCart(3)
      expect(made.status).toBe(200)
      const { id: cartId, items } = made.data.cart
      const lineId = items[0]?.id ?? ""
      // A limit set after the line came in: raising is refused, lowering passes
      await setLimit(1)
      const raised = await change(cartId, lineId, 4)
      expect([raised.status, raised.data.message]).toEqual([400, "cart.max_quantity"])
      const lowered = await change(cartId, lineId, 2)
      expect(lowered.status).toBe(200)
      expect(lowered.data.cart.items[0]?.quantity).toBe(2)
    })

    it("refuses to complete a cart past the limit, and completes within it", async () => {
      const cartId = await shippedCart(getContainer(), shop, product.variantId)
      const { data } = await settle(
        http.get<{ cart: Cart }>(`/store/carts/${cartId}?fields=${CART_FIELDS}`, {
          headers: store.headers,
        })
      )
      const lineId = data.cart.items[0]?.id ?? ""
      expect((await change(cartId, lineId, 3)).status).toBe(200)
      // The limit set while the cart held three
      await setLimit(2)
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: cartId } })
      const refused = await completeWithSystemPayment(getContainer(), cartId, collection.id)
      expect(refused).toEqual({ order_id: null, message: "cart.max_quantity" })

      await setLimit(3)
      const placed = await completeWithSystemPayment(getContainer(), cartId, collection.id)
      expect(placed.message).toBeNull()
      expect(placed.order_id).toEqual(expect.any(String))
    })
  },
})
