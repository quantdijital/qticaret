import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { orderOne, stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(120 * 1000)

const PRICES = [{ currency_code: "try", amount: 100 }]

/** F3.8 (adr/0020): selling past stock (preorder), behind its flag. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const post = (url: string, body: unknown) =>
      settle(http.post<{ message?: string }>(url, body, { headers: admin.headers }))
    const setFlag = async (enabled: boolean) => {
      expect((await post("/admin/features/stock.preorder", { enabled })).status).toBe(200)
    }

    const levelsOf = (itemId: string) =>
      getContainer().resolve(Modules.INVENTORY).listInventoryLevels({ inventory_item_id: itemId })

    async function itemOf(variantId: string): Promise<string> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product_variant",
          fields: ["inventory_items.inventory_item_id"],
          filters: { id: variantId },
        })
      const row = data[0] as { inventory_items?: { inventory_item_id: string }[] } | undefined
      return row?.inventory_items?.[0]?.inventory_item_id ?? ""
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    it("refuses selling past stock while the flag is off, by whichever route", async () => {
      const { productId, variantId } = await stockedProduct(getContainer(), shop, "kapali", 3)
      const option = { Seçenek: "Standart" }
      const asks: [string, unknown][] = [
        [
          "/admin/products",
          {
            title: "Ön sipariş",
            options: [{ title: "Seçenek", values: ["Standart"] }],
            variants: [
              { title: "Standart", options: option, prices: PRICES, allow_backorder: true },
            ],
          },
        ],
        [`/admin/products/${productId}`, { variants: [{ id: variantId, allow_backorder: true }] }],
        // An id that names no variant is a new one
        [
          `/admin/products/${productId}`,
          { variants: [{ id: "variant_01NOTAVARIANT0000000000000", allow_backorder: true }] },
        ],
        [
          "/admin/products/batch",
          { update: [{ id: productId, variants: [{ id: variantId, allow_backorder: true }] }] },
        ],
        [
          `/admin/products/${productId}/variants`,
          { title: "Yeni", options: option, prices: PRICES, allow_backorder: true },
        ],
        [`/admin/products/${productId}/variants/${variantId}`, { allow_backorder: true }],
        [
          `/admin/products/${productId}/variants/batch`,
          { update: [{ id: variantId, allow_backorder: true }] },
        ],
      ]
      for (const [url, body] of asks) {
        const answer = await post(url, body)
        expect([url, answer.status, answer.data.message]).toEqual([
          url,
          400,
          "stock.preorder_disabled",
        ])
      }
      // Not selling past stock is no claim at all
      expect(
        (
          await post(`/admin/products/${productId}/variants/${variantId}`, {
            allow_backorder: false,
          })
        ).status
      ).toBe(200)
    })

    it("keeps a variant that already sells past stock when the flag goes off", async () => {
      const { productId, variantId } = await stockedProduct(getContainer(), shop, "suren", 3)
      const variantUrl = `/admin/products/${productId}/variants/${variantId}`
      await setFlag(true)
      expect((await post(variantUrl, { allow_backorder: true })).status).toBe(200)
      await setFlag(false)

      // Its other fields still save, the setting sent along as it is
      const saved = await post(variantUrl, { title: "Büyük", allow_backorder: true })
      expect(saved.status).toBe(200)
      expect((await post(variantUrl, { allow_backorder: false })).status).toBe(200)
      // Off once, it is a new claim again
      expect((await post(variantUrl, { allow_backorder: true })).status).toBe(400)
    })

    it("gives a preorder variant the empty level checkout needs within the save, and sells it", async () => {
      await setFlag(true)
      const byVariant = await stockedProduct(getContainer(), shop, "on-siparis", null)
      const byBatch = await stockedProduct(getContainer(), shop, "toplu", null)
      const byProduct = await stockedProduct(getContainer(), shop, "urun-guncelle", null)
      const saves: [string, unknown][] = [
        [
          `/admin/products/${byVariant.productId}/variants/${byVariant.variantId}`,
          { allow_backorder: true },
        ],
        // As the panel's product page saves
        [
          `/admin/products/${byBatch.productId}/variants/batch`,
          { update: [{ id: byBatch.variantId, allow_backorder: true }] },
        ],
        [
          `/admin/products/${byProduct.productId}`,
          { variants: [{ id: byProduct.variantId, allow_backorder: true }] },
        ],
      ]
      for (const [url, body] of saves) {
        expect([url, (await post(url, body)).status]).toEqual([url, 200])
      }
      // Made selling past stock, in Medusa's own way (the wizard writes its levels itself)
      const made = await post("/admin/products", {
        title: "Ön sipariş kupa",
        options: [{ title: "Seçenek", values: ["Standart"] }],
        variants: [
          {
            title: "Standart",
            options: { Seçenek: "Standart" },
            prices: PRICES,
            manage_inventory: true,
            allow_backorder: true,
          },
        ],
      })
      const madeVariant = (made.data as { product?: { variants?: { id: string }[] } }).product
        ?.variants?.[0]?.id
      const items = [byVariant.itemId, byBatch.itemId, byProduct.itemId]
      items.push(await itemOf(madeVariant ?? ""))
      for (const itemId of items) {
        expect(await levelsOf(itemId)).toEqual([
          expect.objectContaining({ location_id: shop.locationId, stocked_quantity: 0 }),
        ])
      }

      // Nothing on the shelf, yet the order is taken and held
      await orderOne(getContainer(), shop, byVariant.variantId)
      expect(await levelsOf(byVariant.itemId)).toEqual([
        expect.objectContaining({ stocked_quantity: 0, reserved_quantity: 1 }),
      ])
    })
  },
})
