import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { firstLineOf, orderOne, stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(120 * 1000)

/** F3.7 (adr/0020): stock reserved at checkout, given back on cancel, back on the shelf on return. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const post = <T>(url: string, body: unknown = {}) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const product = (handle: string, quantity: number) =>
      stockedProduct(getContainer(), shop, handle, quantity)
    const order = (variantId: string) => orderOne(getContainer(), shop, variantId)
    const level = async (itemId: string) => {
      const [found] = await getContainer()
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: itemId, location_id: shop.locationId })
      return { stocked: found?.stocked_quantity, reserved: found?.reserved_quantity }
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    it("sells the last unit to one of two checkouts at once (KK)", async () => {
      const { variantId, itemId } = await product("son-kupa", 1)
      const results = await Promise.allSettled([order(variantId), order(variantId)])
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
      // One reservation and never more than the shelf holds
      expect(await level(itemId)).toEqual({ stocked: 1, reserved: 1 })
    })

    it("gives the reservation back when an order is canceled", async () => {
      const { variantId, itemId } = await product("iptal-kupa", 1)
      const orderId = await order(variantId)
      expect(await level(itemId)).toEqual({ stocked: 1, reserved: 1 })

      expect((await post(`/admin/orders/${orderId}/cancel`)).status).toBe(200)
      expect(await level(itemId)).toEqual({ stocked: 1, reserved: 0 })
      // The unit can be sold again
      await expect(order(variantId)).resolves.toEqual(expect.any(String))
    })

    it("takes shipped stock off the shelf and puts a received return back", async () => {
      const { variantId, itemId } = await product("iade-kupa", 2)
      const orderId = await order(variantId)
      const lineId = await firstLineOf(getContainer(), orderId)
      const shipped = await post(`/admin/orders/${orderId}/fulfillments`, {
        items: [{ id: lineId, quantity: 1 }],
        location_id: shop.locationId,
      })
      expect(shipped.status).toBe(200)
      expect(await level(itemId)).toEqual({ stocked: 1, reserved: 0 })

      const begun = await post<{ return: { id: string } }>("/admin/returns", {
        order_id: orderId,
        location_id: shop.locationId,
      })
      const returnId = begun.data.return.id
      for (const [path, body] of [
        [`/admin/returns/${returnId}/request-items`, { items: [{ id: lineId, quantity: 1 }] }],
        [`/admin/returns/${returnId}/request`, {}],
        [`/admin/returns/${returnId}/receive`, {}],
        [`/admin/returns/${returnId}/receive-items`, { items: [{ id: lineId, quantity: 1 }] }],
        [`/admin/returns/${returnId}/receive/confirm`, {}],
      ] as const) {
        expect((await post(path, body)).status).toBe(200)
      }
      expect(await level(itemId)).toEqual({ stocked: 2, reserved: 0 })
    })
  },
})
