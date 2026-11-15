import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { joinGroup, tierRecords, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface StoreProduct {
  product: { variants: { calculated_price: { calculated_amount: number } }[] }
}

/**
 * ADR-0068 §9: Medusa's own routes refuse writes to the wholesale
 * module's groups and lists, and list neither; with the flag off its
 * lists are drafts and a wholesaler pays retail, until it is on again.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      await staff.flag(true)
    })

    const message = (answer: { data: unknown }) => (answer.data as { message?: string }).message

    it("refuses every write round the module to its group and list", async () => {
      const product = await stockedProduct(getContainer(), shop, "korunan", null, 100)
      const customer = await registerCustomer(http, store)
      const tier = await staff.tier({ name: "Toptan Korunan" })
      const { groupId, priceListId } = await tierRecords(getContainer(), tier.id)
      const price = [{ variant_id: product.variantId, currency_code: "try", amount: 1 }]

      const refused = [
        await staff.post(`/admin/customer-groups/${groupId}/customers`, { add: [customer.id] }),
        await staff.post(`/admin/customers/${customer.id}/customer-groups`, { add: [groupId] }),
        await staff.post(`/admin/customer-groups/${groupId}`, { name: "Başka" }),
        await staff.del(`/admin/customer-groups/${groupId}`),
        await staff.post(`/admin/price-lists/${priceListId}`, { status: "draft" }),
        await staff.post(`/admin/price-lists/${priceListId}/prices/batch`, { create: price }),
        await staff.post(`/admin/price-lists/${priceListId}/products`, { remove: [] }),
        await staff.post(`/admin/price-lists/${priceListId}/discount`, {
          product_ids: [product.productId],
          percent: 90,
        }),
        await staff.del(`/admin/price-lists/${priceListId}`),
        await staff.post("/admin/price-lists", {
          title: "Arka kapı",
          description: "",
          status: "active",
          type: "override",
          rules: { "customer.groups.id": [groupId] },
          prices: price,
        }),
      ]
      expect(refused.map((answer) => [answer.status, message(answer)])).toEqual(
        refused.map(() => [409, "wholesale.managed"])
      )
      // A read by id answers as missing, for the owner too (M1): the wholesale screens read them
      const missing = [
        await staff.get(`/admin/price-lists/${priceListId}`),
        await staff.get(`/admin/price-lists/${priceListId}/lines`),
        await staff.get(`/admin/customer-groups/${groupId}`),
        await staff.get(`/admin/customer-groups/${groupId}/customers`),
      ]
      expect(missing.map((answer) => answer.status)).toEqual([404, 404, 404, 404])
      // Another group is anyone's
      const other = await staff.post<{ customer_group: { id: string } }>("/admin/customer-groups", {
        name: "Sadık",
      })
      const joined = await staff.post(
        `/admin/customer-groups/${other.data.customer_group.id}/customers`,
        { add: [customer.id] }
      )
      expect(joined.status).toBe(200)
    })

    it("leaves the module's list and group out of Medusa's own lists", async () => {
      const tier = await staff.tier({ name: "Toptan Gizli" })
      const { groupId, priceListId } = await tierRecords(getContainer(), tier.id)
      await staff.post("/admin/customer-groups", { name: "Görünen" })

      const lists = await staff.get<{ price_lists: { id: string }[]; count: number }>(
        "/admin/price-lists?limit=200"
      )
      expect(lists.data.price_lists.map((list) => list.id)).not.toContain(priceListId)
      expect(lists.data.count).toBe(lists.data.price_lists.length)
      const groups = await staff.get<{ customer_groups: { id: string; name: string }[] }>(
        "/admin/customer-groups?limit=200"
      )
      expect(groups.data.customer_groups.map((group) => group.id)).not.toContain(groupId)
      expect(groups.data.customer_groups.map((group) => group.name)).toContain("Görünen")
    })

    it("drafts the module's lists with the flag off, so a wholesaler pays retail", async () => {
      const product = await stockedProduct(getContainer(), shop, "bayrak", null, 100)
      const customer = await registerCustomer(http, store)
      const tier = await staff.tier({ name: "Toptan Bayrak" })
      await staff.prices(tier.id, { set: [{ variant_id: product.variantId, net: "66.67" }] })
      await joinGroup(
        getContainer(),
        (await tierRecords(getContainer(), tier.id)).groupId,
        customer.id
      )
      const priceNow = async () =>
        (
          await settle(
            http.get<StoreProduct>(
              `/store/products/${product.productId}?region_id=${shop.regionId}&fields=*variants.calculated_price`,
              { headers: customer.headers }
            )
          )
        ).data.product.variants[0]?.calculated_price.calculated_amount

      expect(await priceNow()).toBe(80)
      expect((await staff.flag(false)).status).toBe(200)
      expect(await priceNow()).toBe(100)
      expect((await staff.flag(true)).status).toBe(200)
      expect(await priceNow()).toBe(80)
    })
  },
})
