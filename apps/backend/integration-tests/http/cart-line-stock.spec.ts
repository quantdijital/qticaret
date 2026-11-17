import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Answer {
  message?: string
  values?: Record<string, string>
  cart?: { id: string; items?: { id: string; variant_id: string; quantity: number }[] }
}

/**
 * A shopper asking for more units than are for sale on the store line
 * routes hears `cart.insufficient_stock`, with the units for sale when few,
 * instead of Medusa's own text; every other refusal is answered as before.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let store: Storefront

    const post = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: store.headers }))

    async function cartWith(variantId: string, quantity: number) {
      const made = await post("/store/carts", { region_id: shop.regionId })
      expect(made.status).toBe(200)
      const cartId = made.data.cart?.id ?? ""
      const added = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: variantId,
        quantity,
      })
      expect(added.status).toBe(200)
      const line = added.data.cart?.items?.find((item) => item.variant_id === variantId)
      return { cartId, lineId: line?.id ?? "" }
    }

    beforeEach(async () => {
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
    })

    it("says a line's new quantity is more than the shelf has, naming the units", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "tek-kalan", 1)
      const { cartId, lineId } = await cartWith(variantId, 1)

      const raised = await post(`/store/carts/${cartId}/line-items/${lineId}`, { quantity: 2 })
      expect([raised.status, raised.data.message, raised.data.values]).toEqual([
        400,
        "cart.insufficient_stock",
        { available: "1" },
      ])
      // The line keeps the quantity it had
      const cart = await settle(
        http.get<Answer>(`/store/carts/${cartId}`, { headers: store.headers })
      )
      expect(cart.data.cart?.items?.map((item) => item.quantity)).toEqual([1])
    })

    it("says the same for an add of more units than are for sale", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "uc-kalan", 3)
      const made = await post("/store/carts", { region_id: shop.regionId })
      const cartId = made.data.cart?.id ?? ""

      const added = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: variantId,
        quantity: 5,
      })
      expect([added.status, added.data.message, added.data.values]).toEqual([
        400,
        "cart.insufficient_stock",
        { available: "3" },
      ])
    })

    it("names no count when the shelf holds many", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "bol-stok", 12)
      const made = await post("/store/carts", { region_id: shop.regionId })
      const cartId = made.data.cart?.id ?? ""

      const added = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: variantId,
        quantity: 20,
      })
      expect(added.status).toBe(400)
      expect(added.data.message).toBe("cart.insufficient_stock")
      expect(added.data.values).toBeUndefined()
    })

    it("answers every other refusal on the line routes as before", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "baska-ret", 3)
      const { cartId } = await cartWith(variantId, 1)

      // A line that is not the cart's: Medusa's own not-found answer
      const unknownLine = await post(
        `/store/carts/${cartId}/line-items/cali_01JABCDEFGHJKMNPQRSTVWXYZ`,
        { quantity: 2 }
      )
      expect([unknownLine.status, unknownLine.data.message]).toEqual([
        404,
        "Line item with id: cali_01JABCDEFGHJKMNPQRSTVWXYZ was not found",
      ])
      // A variant that does not exist: Medusa's invalid-data answer, the storefront's "not for sale"
      const unknownVariant = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: "variant_01JABCDEFGHJKMNPQRSTVWXYZ",
        quantity: 1,
      })
      expect(unknownVariant.status).toBe(400)
      expect(unknownVariant.data).toMatchObject({ type: "invalid_data" })
      expect(unknownVariant.data.message).not.toBe("cart.insufficient_stock")
      expect(unknownVariant.data.values).toBeUndefined()
    })
  },
})
