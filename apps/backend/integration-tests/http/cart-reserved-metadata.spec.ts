import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Metadata = Record<string, unknown> | null

interface Answer {
  message?: string
  cart?: { id: string; metadata?: Metadata; items?: { id: string; metadata?: Metadata }[] }
}

const RESERVED = { qt_fraud_signals: { ips: 1 }, qt_sms_held: true }

/**
 * Metadata under `qt_` is the server's (fraud signals, held texts, the
 * order note): a storefront's metadata on a cart or a line neither sets it
 * nor wipes it, whatever it sends (`{}`, `null`, its own keys, `""`).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let store: Storefront

    const post = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: store.headers }))

    const cartModule = () => getContainer().resolve(Modules.CART)

    async function markedCart() {
      const { variantId } = await stockedProduct(getContainer(), shop, "metadata-koruma", 5)
      const made = await post("/store/carts", { region_id: shop.regionId })
      const cartId = made.data.cart?.id ?? ""
      const added = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: variantId,
        quantity: 1,
      })
      const lineId = added.data.cart?.items?.[0]?.id ?? ""
      // The server's own writes, as our workflows make them
      await cartModule().updateCarts(cartId, { metadata: { ...RESERVED, shop_note: "eski" } })
      await cartModule().updateLineItems(lineId, { metadata: { qt_addons: [{ id: "a" }] } })
      return { cartId, lineId }
    }

    const cartMetadata = async (cartId: string) =>
      (await cartModule().retrieveCart(cartId, { select: ["metadata"] })).metadata ?? null
    const lineMetadata = async (lineId: string) =>
      (await cartModule().retrieveLineItem(lineId, { select: ["metadata"] })).metadata ?? null

    beforeEach(async () => {
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
    })

    it("keeps the cart's reserved keys through any storefront metadata", async () => {
      const { cartId } = await markedCart()

      const emptied = await post(`/store/carts/${cartId}`, { metadata: {} })
      expect(emptied.status).toBe(200)
      expect(await cartMetadata(cartId)).toMatchObject(RESERVED)

      const nulled = await post(`/store/carts/${cartId}`, { metadata: null })
      expect(nulled.status).toBe(200)
      expect(await cartMetadata(cartId)).toMatchObject(RESERVED)

      const own = await post(`/store/carts/${cartId}`, { metadata: { foo: 1 } })
      expect(own.status).toBe(200)
      expect(await cartMetadata(cartId)).toMatchObject({ ...RESERVED, foo: 1 })

      // Removing a reserved key ("" deletes in Medusa) is refused like setting one
      const removed = await post(`/store/carts/${cartId}`, { metadata: { qt_sms_held: "" } })
      expect([removed.status, removed.data.message]).toEqual([400, "cart.metadata_reserved"])
      expect(await cartMetadata(cartId)).toMatchObject(RESERVED)
    })

    it("still clears the storefront's own keys when it sends no metadata", async () => {
      const { cartId } = await markedCart()
      await post(`/store/carts/${cartId}`, { metadata: { foo: 1 } })

      await post(`/store/carts/${cartId}`, { metadata: null })

      const after = await cartMetadata(cartId)
      expect(after).toMatchObject(RESERVED)
      expect(after).not.toHaveProperty("foo")
    })

    it("keeps a line's reserved keys through a storefront's line update", async () => {
      const { cartId, lineId } = await markedCart()

      const emptied = await post(`/store/carts/${cartId}/line-items/${lineId}`, {
        quantity: 2,
        metadata: {},
      })
      expect(emptied.status).toBe(200)
      const nulled = await post(`/store/carts/${cartId}/line-items/${lineId}`, {
        quantity: 2,
        metadata: null,
      })
      expect(nulled.status).toBe(200)
      expect(await lineMetadata(lineId)).toMatchObject({ qt_addons: [{ id: "a" }] })

      const removed = await post(`/store/carts/${cartId}/line-items/${lineId}`, {
        quantity: 1,
        metadata: { qt_addons: "" },
      })
      expect([removed.status, removed.data.message]).toEqual([400, "cart.metadata_reserved"])
      expect(await lineMetadata(lineId)).toMatchObject({ qt_addons: [{ id: "a" }] })
    })

    it("refuses reserved keys in a cart address's metadata", async () => {
      const { cartId } = await markedCart()

      const refused = await post(`/store/carts/${cartId}`, {
        shipping_address: { first_name: "Ayşe", metadata: { qt_x: 1 } },
      })

      expect([refused.status, refused.data.message]).toEqual([400, "cart.metadata_reserved"])
    })
  },
})
