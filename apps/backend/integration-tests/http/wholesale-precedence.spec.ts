import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { setManualPricesWorkflow } from "../../src/workflows/wholesale/manual-prices"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { joinGroup, privateList, tierRecords, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface StoreProduct {
  product: { variants: { id: string; calculated_price: { calculated_amount: number } }[] }
}

/**
 * ADR-0068 §2 acceptance gate on Medusa 2.21.2, as Ek 2026-11-15 settles
 * it, through the Store API's own pricing with a signed-in customer: the
 * wholesaler's own list (its rows carrying the hidden group as a price
 * rule, written by the module) over the level's `override` list, whether
 * dearer or cheaper; the level over every public list, sale or override,
 * which still reaches a guest. Retail is 100 TL, KDV 20% included; prices
 * are entered KDV excluded (66.67 net is 80.00).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      staff = wholesaleApi(http, admin.headers)
      shop = await stockShop(container)
      store = await createStorefront(container)
      expect((await staff.flag(true)).status).toBe(200)
    })

    /** What the Store API prices the product at, for this shopper (no customer: a guest). */
    async function priceFor(productId: string, headers: Record<string, string>) {
      const answer = await settle(
        http.get<StoreProduct>(
          `/store/products/${productId}?region_id=${shop.regionId}&fields=*variants.calculated_price`,
          { headers }
        )
      )
      expect(answer.status).toBe(200)
      return answer.data.product.variants[0]?.calculated_price.calculated_amount
    }

    /** A product at 100 TL, a member of a level priced 80.00 (66.67 net) by hand. */
    async function levelMember(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, null, 100)
      const customer = await registerCustomer(http, store)
      const tier = await staff.tier({ name: `Toptan ${handle}` })
      const set = await staff.prices(tier.id, {
        set: [{ variant_id: product.variantId, net: "66.67" }],
      })
      expect(set.status).toBe(200)
      await joinGroup(
        getContainer(),
        (await tierRecords(getContainer(), tier.id)).groupId,
        customer.id
      )
      return { ...product, customer, tier }
    }

    /** The wholesaler's own price, KDV excluded, as the module writes it. */
    async function ownPrice(customerId: string, variantId: string, net: number) {
      const own = await privateList(getContainer(), customerId)
      await setManualPricesWorkflow(getContainer()).run({
        input: {
          list: {
            kind: "private",
            price_list_id: own.priceListId,
            customer_group_id: own.groupId,
            rate_bps: null,
          },
          set: [{ variant_id: variantId, net_amount: net }],
          remove: [],
          created_by: null,
        },
      })
    }

    async function publicList(type: "sale" | "override", variantId: string, amount: number) {
      const made = await staff.post("/admin/price-lists", {
        title: `Herkese ${type}`,
        description: "",
        status: "active",
        type,
        prices: [{ variant_id: variantId, currency_code: "try", amount }],
      })
      expect(made.status).toBe(200)
    }

    it("prices a level's member from the level's list; a guest pays retail", async () => {
      const { productId, customer, tier } = await levelMember("seviye")

      expect(await priceFor(productId, customer.headers)).toBe(80)
      expect(await priceFor(productId, store.headers)).toBe(100)
      expect((await staff.lines(tier.id)).lines).toMatchObject([
        { net: "66.67", gross: "80.00", source: "manual", undercut: false },
      ])
    })

    it("gives the wholesaler's own price over the level's when dearer", async () => {
      const { productId, variantId, customer } = await levelMember("ozel-pahali")
      // 75.00 net is 90.00
      await ownPrice(customer.id, variantId, 7500)

      expect(await priceFor(productId, customer.headers)).toBe(90)
    })

    it("gives the wholesaler's own price over the level's when cheaper", async () => {
      const { productId, variantId, customer } = await levelMember("ozel-ucuz")
      // 58.33 net is 69.996: 70.00
      await ownPrice(customer.id, variantId, 5833)

      expect(await priceFor(productId, customer.headers)).toBe(70)
    })

    it("keeps a public sale cheaper than the level from the wholesaler, and flags it", async () => {
      const { productId, variantId, customer, tier } = await levelMember("kampanya")
      await publicList("sale", variantId, 60)

      expect(await priceFor(productId, store.headers)).toBe(60)
      expect(await priceFor(productId, customer.headers)).toBe(80)
      const { lines, undercut_count } = await staff.lines(tier.id)
      expect({ undercut_count, line: lines[0] }).toMatchObject({
        undercut_count: 1,
        line: { retail_now: "60.00", gross: "80.00", undercut: true },
      })
    })

    it("keeps a public override list from the wholesaler too", async () => {
      const { productId, variantId, customer } = await levelMember("herkese-override")
      await publicList("override", variantId, 60)

      expect(await priceFor(productId, store.headers)).toBe(60)
      expect(await priceFor(productId, customer.headers)).toBe(80)
    })
  },
})
