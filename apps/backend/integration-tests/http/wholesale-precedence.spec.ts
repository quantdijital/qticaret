import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface StoreProduct {
  product: { variants: { id: string; calculated_price: { calculated_amount: number } }[] }
}

/**
 * ADR-0068 §2 acceptance gate, on Medusa 2.21.2, through the Store API's
 * own pricing with a signed-in customer: a wholesaler's own `override`
 * list over its level's `sale` list over retail, and a public sale cheaper
 * than the level reaching the wholesaler. Built from Medusa's own admin
 * routes alone, so it says what Medusa does before the wholesale module
 * relies on it. The last case probes the remedy for a tie between the two
 * lists (a price rule on the private list's rows).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      shop = await stockShop(container)
      store = await createStorefront(container)
    })

    async function send<T>(url: string, body: unknown): Promise<T> {
      const answer = await settle(http.post<T>(url, body, { headers: admin.headers }))
      expect({ url, status: answer.status }).toEqual({ url, status: 200 })
      return answer.data
    }

    async function group(name: string, customerId?: string): Promise<string> {
      const made = await send<{ customer_group: { id: string } }>("/admin/customer-groups", {
        name,
      })
      const id = made.customer_group.id
      if (customerId) {
        await send(`/admin/customer-groups/${id}/customers`, { add: [customerId] })
      }
      return id
    }

    async function list(
      title: string,
      type: "sale" | "override",
      groupId: string | null,
      variantId: string,
      amount: number
    ): Promise<void> {
      await send("/admin/price-lists", {
        title,
        description: "",
        status: "active",
        type,
        ...(groupId ? { rules: { "customer.groups.id": [groupId] } } : {}),
        prices: [{ variant_id: variantId, currency_code: "try", amount }],
      })
    }

    /** What the Store API prices the product at, for this shopper (no headers: a guest). */
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

    async function setup(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, null, 100)
      const customer = await registerCustomer(http, store)
      return { ...product, customer }
    }

    it("prices a level's member from the level's sale list; a guest pays retail", async () => {
      const { productId, variantId, customer } = await setup("toptan-seviye")
      await list("Toptan A", "sale", await group("Toptan A", customer.id), variantId, 80)

      expect(await priceFor(productId, customer.headers)).toBe(80)
      expect(await priceFor(productId, store.headers)).toBe(100)
    })

    it("gives the wholesaler's own override price over the level's, even when dearer", async () => {
      const { productId, variantId, customer } = await setup("toptan-ozel-pahali")
      await list("Toptan A", "sale", await group("Toptan A", customer.id), variantId, 80)
      await list("Özel", "override", await group("Özel", customer.id), variantId, 90)

      expect(await priceFor(productId, customer.headers)).toBe(90)
    })

    it("gives the wholesaler's own override price over the level's when cheaper", async () => {
      const { productId, variantId, customer } = await setup("toptan-ozel-ucuz")
      await list("Toptan A", "sale", await group("Toptan A", customer.id), variantId, 80)
      await list("Özel", "override", await group("Özel", customer.id), variantId, 70)

      expect(await priceFor(productId, customer.headers)).toBe(70)
    })

    it("lets a public sale cheaper than the level reach the wholesaler", async () => {
      const { productId, variantId, customer } = await setup("toptan-kampanya")
      await list("Toptan A", "sale", await group("Toptan A", customer.id), variantId, 80)
      await list("Kasım indirimi", "sale", null, variantId, 60)

      expect(await priceFor(productId, store.headers)).toBe(60)
      expect(await priceFor(productId, customer.headers)).toBe(60)
    })

    it("probe: private rows carrying their group as a price rule outrank the level", async () => {
      const { productId, variantId, customer } = await setup("toptan-ozel-kural")
      await list("Toptan A", "sale", await group("Toptan A", customer.id), variantId, 80)
      const privateGroup = await group("Özel", customer.id)
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product_variant", fields: ["price_set.id"], filters: { id: variantId } })
      const priceSetId = (data[0] as { price_set: { id: string } }).price_set.id
      await getContainer()
        .resolve(Modules.PRICING)
        .createPriceLists([
          {
            title: "Özel (kurallı satır)",
            description: "",
            type: "override",
            status: "active",
            rules: { "customer.groups.id": [privateGroup] },
            prices: [
              {
                amount: 90,
                currency_code: "try",
                price_set_id: priceSetId,
                rules: { "customer.groups.id": privateGroup },
              },
            ],
          },
        ])

      expect(await priceFor(productId, customer.headers)).toBe(90)
    })
  },
})
