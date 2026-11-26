import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { orderOne, stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(120 * 1000)

// A level's quantities may come back as big-number values
const count = (value: unknown): number => Number(value)

interface TrackingAnswer {
  variants: { id: string; manage_inventory: boolean; inventory_item_id: string | null }[]
}

/** A published product whose one variant's stock is not counted, as an import's `Takipsiz` makes it. */
async function untrackedProduct(
  container: MedusaContainer,
  shop: StockShop,
  handle: string
): Promise<{ productId: string; variantId: string }> {
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: handle,
          handle,
          status: "published",
          shipping_profile_id: shop.shippingProfileId,
          options: [{ title: "Boy", values: ["20 cm"] }],
          variants: [
            {
              title: "20 cm",
              sku: `${handle}-20`,
              options: { Boy: "20 cm" },
              manage_inventory: false,
              prices: [{ currency_code: "try", amount: 100 }],
            },
          ],
          sales_channels: [{ id: shop.salesChannelId }],
        },
      ],
    },
  })
  return { productId: result[0]?.id ?? "", variantId: result[0]?.variants[0]?.id ?? "" }
}

/** F3.7 (docs/06 "Ürün sayfası"): a variant's stock tracking turned on and off after it was made. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const track = (productId: string, body: unknown) =>
      settle(
        http.post<TrackingAnswer>(`/admin/products/${productId}/stock-tracking`, body, {
          headers: admin.headers,
        })
      )
    const variantOf = async (variantId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product_variant",
          fields: ["manage_inventory", "inventory_items.inventory_item_id"],
          filters: { id: variantId },
        })
      const row = data[0] as {
        manage_inventory: boolean
        inventory_items: { inventory_item_id: string }[]
      }
      return {
        tracked: row.manage_inventory,
        items: row.inventory_items.map((each) => each.inventory_item_id),
      }
    }
    const stockedAt = async (itemId: string) => {
      const levels = await getContainer()
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: itemId })
      return levels.map((level) => ({
        location_id: level.location_id,
        stocked: count(level.stocked_quantity),
      }))
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    it("turns tracking on with a count, off keeping the item, and on again idempotently", async () => {
      const { productId, variantId } = await untrackedProduct(getContainer(), shop, "takip-bicak")
      expect(await variantOf(variantId)).toEqual({ tracked: false, items: [] })

      const on = await track(productId, {
        tracked: true,
        variants: [{ id: variantId, quantity: 7 }],
      })
      expect(on.status).toBe(200)
      const itemId = on.data.variants[0]?.inventory_item_id ?? ""
      expect(itemId).not.toBe("")
      expect(on.data.variants).toEqual([
        { id: variantId, manage_inventory: true, inventory_item_id: itemId },
      ])
      expect(await variantOf(variantId)).toEqual({ tracked: true, items: [itemId] })
      expect(await stockedAt(itemId)).toEqual([{ location_id: shop.locationId, stocked: 7 }])

      // Again, without a count: nothing new, nothing moved
      const again = await track(productId, { tracked: true, variants: [{ id: variantId }] })
      expect(again.status).toBe(200)
      expect(await variantOf(variantId)).toEqual({ tracked: true, items: [itemId] })
      expect(await stockedAt(itemId)).toEqual([{ location_id: shop.locationId, stocked: 7 }])

      // Off: the flag only, the item and its count kept
      const off = await track(productId, { tracked: false, variants: [{ id: variantId }] })
      expect(off.status).toBe(200)
      expect(await variantOf(variantId)).toEqual({ tracked: false, items: [itemId] })
      expect(await stockedAt(itemId)).toEqual([{ location_id: shop.locationId, stocked: 7 }])

      // On again finds the count where it was
      expect(
        (await track(productId, { tracked: true, variants: [{ id: variantId }] })).status
      ).toBe(200)
      expect(await variantOf(variantId)).toEqual({ tracked: true, items: [itemId] })
      expect(await stockedAt(itemId)).toEqual([{ location_id: shop.locationId, stocked: 7 }])
    })

    it("links the item Medusa's own 'off' left behind again, by its SKU", async () => {
      const { productId, variantId } = await untrackedProduct(getContainer(), shop, "takip-eski")
      const first = await track(productId, {
        tracked: true,
        variants: [{ id: variantId, quantity: 4 }],
      })
      const itemId = first.data.variants[0]?.inventory_item_id ?? ""
      // An import's `Takipsiz` goes through Medusa's variant workflow, which may drop the link
      await updateProductVariantsWorkflow(getContainer()).run({
        input: { product_variants: [{ id: variantId, manage_inventory: false }] },
      })
      const on = await track(productId, { tracked: true, variants: [{ id: variantId }] })
      expect(on.status).toBe(200)
      expect(await variantOf(variantId)).toEqual({ tracked: true, items: [itemId] })
      expect(await stockedAt(itemId)).toEqual([{ location_id: shop.locationId, stocked: 4 }])
    })

    it("refuses turning off while an order holds its stock, and another product's variant", async () => {
      const held = await stockedProduct(getContainer(), shop, "takip-siparis", 3)
      await orderOne(getContainer(), shop, held.variantId)
      const off = await track(held.productId, {
        tracked: false,
        variants: [{ id: held.variantId }],
      })
      expect(off.status).toBe(409)
      expect((await variantOf(held.variantId)).tracked).toBe(true)

      const other = await untrackedProduct(getContainer(), shop, "takip-baska")
      const foreign = await track(other.productId, {
        tracked: true,
        variants: [{ id: held.variantId, quantity: 1 }],
      })
      expect(foreign.status).toBe(404)
      // A count with tracking off is refused by the body's rules
      const counted = await track(other.productId, {
        tracked: false,
        variants: [{ id: other.variantId, quantity: 2 }],
      })
      expect(counted.status).toBe(400)
      expect(await variantOf(other.variantId)).toEqual({ tracked: false, items: [] })
    })
  },
})
