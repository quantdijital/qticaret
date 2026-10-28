import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { firstLineOf, orderOne, stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"
import { medusaReturn } from "../helpers/medusa-return"

jest.setTimeout(120 * 1000)

interface Rejection {
  message: string
  issues?: { field: string; code: string }[]
}

interface LocationRow {
  id: string
  name: string
  address?: Record<string, string | null> | null
  sales_channels?: { id: string }[]
}

const ADDRESS = { address_1: "Moda Caddesi No: 1", country_code: "tr", province: "İstanbul" }

/** F3.7: warehouses kept by the panel, their Turkish addresses, and the ones kept from deletion. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const post = <T>(url: string, body: unknown = {}) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const remove = (id: string) =>
      settle(http.delete<Rejection>(`/admin/stock-locations/${id}`, admin))
    const locations = () => getContainer().resolve(Modules.STOCK_LOCATION)
    const location = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "stock_location",
          fields: ["id", "name", "address.*", "sales_channels.id"],
          filters: { id },
        })
      return data[0] as LocationRow
    }
    const defaultLocationId = async () => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "store", fields: ["default_location_id"] })
      return (data[0] as { default_location_id: string }).default_location_id
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      await loadTrAddressFixture(getContainer())
    })

    it("lists provinces and districts for the panel's address forms", async () => {
      const { data: provinces } = await http.get<{ provinces: { code: string; name: string }[] }>(
        "/admin/tr-address/provinces",
        admin
      )
      expect(provinces.provinces.map((province) => province.name)).toContain("İstanbul")
      const districts = await http.get<{ districts: { name: string }[] }>(
        "/admin/tr-address/districts?province=34",
        admin
      )
      expect(districts.data.districts.map((district) => district.name).sort()).toEqual([
        "Beşiktaş",
        "Kadıköy",
      ])
      expect(districts.headers["cache-control"]).toBe("private, max-age=3600")
    })

    it("checks a warehouse's Turkish address, on the panel's routes and Medusa's", async () => {
      const wrong = await post<Rejection>("/admin/warehouses", {
        name: "Kadıköy Depo",
        address: { ...ADDRESS, city: "Çankaya" },
      })
      expect(wrong.status).toBe(400)
      expect(wrong.data).toMatchObject({
        message: "tr_address.district_not_in_province",
        issues: [{ field: "address.city", code: "tr_address.district_not_in_province" }],
      })
      const core = await post<Rejection>("/admin/stock-locations", {
        name: "Kadıköy Depo",
        address: { ...ADDRESS, city: "Çankaya", postal_code: "06420" },
      })
      expect(core.status).toBe(400)
      // Two issues: the general sentence, each one listed
      expect(core.data.message).toBe("tr_address.invalid")
      expect(core.data.issues).toHaveLength(2)
    })

    it("makes a warehouse that sells to the shop's channel, and changes its address", async () => {
      const made = await post<{ warehouse: { id: string } }>("/admin/warehouses", {
        name: "Kadıköy Depo",
        address: { ...ADDRESS, city: "Kadıköy", postal_code: "34710", phone: "0216 555 12 34" },
      })
      expect(made.status).toBe(201)
      const id = made.data.warehouse.id
      expect(await location(id)).toMatchObject({
        name: "Kadıköy Depo",
        address: { city: "Kadıköy", postal_code: "34710", phone: "+902165551234" },
        sales_channels: [{ id: shop.salesChannelId }],
      })

      // An emptied field is cleared; a partial change is checked against the stored address
      const changed = await post(`/admin/warehouses/${id}`, {
        name: "Moda Depo",
        address: { ...ADDRESS, city: "Kadıköy", postal_code: "", phone: null },
      })
      expect(changed.status).toBe(200)
      expect(await location(id)).toMatchObject({
        name: "Moda Depo",
        address: { postal_code: null, phone: null },
      })
      const moved = await post<Rejection>(`/admin/warehouses/${id}`, {
        name: "Moda Depo",
        address: { address_1: "Moda Caddesi No: 1", country_code: "tr", city: "Çankaya" },
      })
      expect(moved.status).toBe(400)
    })

    it("gives an address to a warehouse that has none (Medusa's own update cannot)", async () => {
      const bare = await locations().createStockLocations({ name: "Adressiz Depo" })
      const saved = await post(`/admin/warehouses/${bare.id}`, {
        name: "Adressiz Depo",
        address: { ...ADDRESS, city: "Beşiktaş" },
      })
      expect(saved.status).toBe(200)
      expect((await location(bare.id)).address).toMatchObject({
        address_1: "Moda Caddesi No: 1",
        province: "İstanbul",
        city: "Beşiktaş",
      })
      // The seed's warehouse got its demo address the same way
      expect((await location(shop.locationId)).address).toMatchObject({ city: "Kadıköy" })
    })

    it("makes another warehouse the default, selling to the shop's channel", async () => {
      const other = await locations().createStockLocations({ name: "İzmir Depo" })
      expect((await post(`/admin/warehouses/${other.id}/default`)).status).toBe(200)
      expect(await defaultLocationId()).toBe(other.id)
      expect((await location(other.id)).sales_channels).toEqual([{ id: shop.salesChannelId }])
    })

    it("keeps the default warehouse, one that holds or awaits stock, and one a return goes to", async () => {
      const refused = await remove(shop.locationId)
      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("stock.location_is_default")

      const { itemId } = await stockedProduct(getContainer(), shop, "yedek-kupa", 0)
      const inventory = getContainer().resolve(Modules.INVENTORY)
      const stocked = await locations().createStockLocations({ name: "Yedek Depo" })
      const awaiting = await locations().createStockLocations({ name: "Gelecek Depo" })
      await inventory.createInventoryLevels([
        { inventory_item_id: itemId, location_id: stocked.id, stocked_quantity: 3 },
        { inventory_item_id: itemId, location_id: awaiting.id, incoming_quantity: 5 },
      ])
      for (const id of [stocked.id, awaiting.id]) {
        const holding = await remove(id)
        expect(holding.status).toBe(409)
        expect(holding.data.message).toBe("stock.location_has_stock")
      }

      // A return on its way to a warehouse keeps it until it arrives or is canceled
      const { variantId } = await stockedProduct(getContainer(), shop, "iade-kupa", 1)
      const orderId = await orderOne(getContainer(), shop, variantId)
      const lineId = await firstLineOf(getContainer(), orderId)
      await post(`/admin/orders/${orderId}/fulfillments`, {
        items: [{ id: lineId, quantity: 1 }],
        location_id: shop.locationId,
      })
      const returnsTo = await locations().createStockLocations({ name: "İade Depo" })
      await medusaReturn(getContainer(), {
        order_id: orderId,
        location_id: returnsTo.id,
        items: [{ id: lineId, quantity: 1 }],
        receive: false,
      })
      const pending = await remove(returnsTo.id)
      expect(pending.status).toBe(409)
      expect(pending.data.message).toBe("stock.location_has_returns")

      const empty = await locations().createStockLocations({ name: "Boş Depo" })
      expect((await remove(empty.id)).status).toBe(200)
    })
  },
})
