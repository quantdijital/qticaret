import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createSegmentWorkflow,
  refreshSegmentWorkflow,
} from "../../src/workflows/customers/segments"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { accountApi, groupsOf, joinGroup, tierRecords, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface StoreProduct {
  product: { variants: { calculated_price: { calculated_amount: number } }[] }
}

/**
 * ADR-0068 Ek 2026-11-15 4: a segment's price list ties with a level's (one
 * group rule each) and the cheaper row wins, so a wholesaler is kept out
 * of every segment: taken out on becoming one, never put back by the
 * daily refresh while active; a closed wholesaler is any customer again.
 * Retail 100, the level 80, the segment's list 50.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let accounts: ReturnType<typeof accountApi>
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      accounts = accountApi(http, admin.headers)
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      await staff.flag(true)
    })

    async function priceFor(productId: string, headers: Record<string, string>) {
      const answer = await settle(
        http.get<StoreProduct>(
          `/store/products/${productId}?region_id=${shop.regionId}&fields=*variants.calculated_price`,
          { headers }
        )
      )
      return answer.data.product.variants[0]?.calculated_price.calculated_amount
    }

    it("keeps a wholesaler out of the segments and their prices", async () => {
      const product = await stockedProduct(getContainer(), shop, "segment", null, 100)
      const tier = await staff.tier({ name: "Toptan segment" })
      await staff.prices(tier.id, { set: [{ variant_id: product.variantId, net: "66.67" }] })
      const customer = await registerCustomer(http, store)

      // A segment of every registered customer, with a sale list of its own at 50
      const { result: segment } = await createSegmentWorkflow(getContainer()).run({
        input: { name: "Kayıtlı müşteriler", rules: { registered: true }, created_by: null },
      })
      await refreshSegmentWorkflow(getContainer()).run({ input: { segment_id: segment.id } })
      expect(await groupsOf(getContainer(), customer.id)).toContain(segment.customer_group_id)
      const list = await staff.post("/admin/price-lists", {
        title: "Kayıtlılara özel",
        description: "",
        status: "active",
        type: "sale",
        rules: { "customer.groups.id": [segment.customer_group_id] },
        prices: [{ variant_id: product.variantId, currency_code: "try", amount: 50 }],
      })
      expect(list.status).toBe(200)
      expect(await priceFor(product.productId, customer.headers)).toBe(50)

      // A wholesaler now: out of the segment at once, the level's price
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      const { groupId } = await tierRecords(getContainer(), tier.id)
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])
      expect(await priceFor(product.productId, customer.headers)).toBe(80)

      // The daily refresh does not put them back, even if someone did
      await joinGroup(getContainer(), segment.customer_group_id, customer.id)
      await refreshSegmentWorkflow(getContainer()).run({ input: { segment_id: segment.id } })
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])

      // Closed, they are any customer again
      await accounts.action(account.id, "deactivate")
      await refreshSegmentWorkflow(getContainer()).run({ input: { segment_id: segment.id } })
      expect(await groupsOf(getContainer(), customer.id)).toEqual([segment.customer_group_id])
      expect(await priceFor(product.productId, customer.headers)).toBe(50)

      // Reopened, out of the segment again
      await accounts.action(account.id, "reactivate")
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])
    })
  },
})
