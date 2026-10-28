import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface WishlistBody {
  items?: { id: string; variant_id: string | null; product: { id: string; handle: string } }[]
  message?: string
}

/** F10.4 (adr/0037 §4): a signed-in customer's saved products, theirs alone. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    let customer: TestCustomer
    let productId: string
    let variantId: string

    const keep = (body: Record<string, string>, who = customer) =>
      settle(
        http.post<WishlistBody>("/store/customers/me/wishlist", body, { headers: who.headers })
      )
    const list = (who = customer) =>
      http.get<WishlistBody>("/store/customers/me/wishlist", { headers: who.headers })

    beforeEach(async () => {
      const container = getContainer()
      storefront = await createStorefront(container)
      customer = await registerCustomer(http, storefront)
      variantId = await createTestProduct(container, storefront.salesChannelId, {
        handle: `bardak-${String(Date.now())}`,
        price: 150,
      })
      const { data } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product_variant", fields: ["product_id"], filters: { id: variantId } })
      productId = (data[0] as { product_id: string }).product_id
    })

    it("keeps a product and a variant of it once each, and lists them", async () => {
      await keep({ product_id: productId })
      await keep({ product_id: productId })
      const kept = await keep({ product_id: productId, variant_id: variantId })
      const { data } = await list()

      expect(kept.status).toBe(200)
      expect(data.items).toHaveLength(2)
      expect(data.items?.map((item) => item.variant_id).sort()).toEqual([null, variantId].sort())
      expect(data.items?.[0]?.product.id).toBe(productId)
    })

    it("keeps no product that is not sold, nor a variant of another product", async () => {
      const unknown = await keep({ product_id: "prod_01UNKNOWN" })
      const other = await createTestProduct(getContainer(), storefront.salesChannelId, {
        handle: `tabak-${String(Date.now())}`,
        price: 90,
      })
      const crossed = await keep({ product_id: productId, variant_id: other })
      await keep({ product_id: productId })
      await getContainer().resolve(Modules.PRODUCT).updateProducts(productId, { status: "draft" })
      const afterDraft = await list()

      expect(unknown.status).toBe(400)
      expect(crossed.status).toBe(400)
      // A product taken off sale drops out of the list
      expect(afterDraft.data.items).toHaveLength(0)
    })

    it("lets nobody but its owner remove an item, and no one see a list without signing in", async () => {
      await keep({ product_id: productId })
      const { data } = await list()
      const stranger = await registerCustomer(http, storefront)
      const theirs = await settle(
        http.delete<{ deleted: boolean }>(
          `/store/customers/me/wishlist/${data.items?.[0]?.id ?? ""}`,
          { headers: stranger.headers }
        )
      )
      const anonymous = await settle(
        http.get("/store/customers/me/wishlist", { headers: storefront.headers })
      )
      const own = await http.delete<{ deleted: boolean }>(
        `/store/customers/me/wishlist/${data.items?.[0]?.id ?? ""}`,
        { headers: customer.headers }
      )

      expect(theirs.data.deleted).toBe(false)
      expect(anonymous.status).toBe(401)
      expect(own.data.deleted).toBe(true)
      expect((await list()).data.items).toHaveLength(0)
    })
  },
})
