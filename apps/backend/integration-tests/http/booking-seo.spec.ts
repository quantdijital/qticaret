import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { publishTour } from "../helpers/booking-tour"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { catalogItems } from "../../src/workflows/marketing/feed-catalog"

jest.setTimeout(180 * 1000)

type Block = Record<string, unknown>
interface Resolved {
  seo?: { jsonLd: Block[] }
}

/**
 * adr/0076 §10: a dated product's page adds its trip beside its `Product`,
 * whose offers name no shipping or returns; the shopping feeds leave it out.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const staff = (url: string, body: unknown) =>
      settle(http.post<Record<string, unknown>>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const blocksOf = async (productId: string): Promise<Block[]> => {
      const { data } = await http.get<{ product: { handle: string } }>(
        `/admin/products/${productId}?fields=handle`,
        { headers: admin.headers }
      )
      const path = `/urun/${data.product.handle}`
      const answer = await settle(
        http.get<Resolved>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      )
      return answer.data.seo?.jsonLd ?? []
    }

    beforeEach(async () => {
      const container = getContainer()
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      // Structured data needs the canonical host: its URLs are absolute
      await staff("/admin/platform-settings/seo", { canonical_host: "ornek.com" })
    })
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
      await staff("/admin/platform-settings/catalog", { dated_schema_type: "TouristTrip" })
    })

    it("adds a trip with its next departure, and no shipping or returns on the product", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      const blocks = await blocksOf(tour.productId)
      const types = blocks.map((block) => block["@type"])
      expect(types).toEqual(["ProductGroup", "TouristTrip", "BreadcrumbList"])
      const trip = blocks[1] as { subTrip: Block[]; provider?: Block }
      expect(trip.subTrip).toHaveLength(1)
      expect(trip.subTrip[0]).toMatchObject({
        "@type": "TouristTrip",
        offers: { "@type": "Offer", price: "900.00", priceCurrency: "TRY" },
      })
      expect(JSON.stringify(blocks)).not.toMatch(/shippingDetails|hasMerchantReturnPolicy/)
    })

    it("makes an event a departure when the shop names that type", async () => {
      expect(
        (await staff("/admin/platform-settings/catalog", { dated_schema_type: "Event" })).status
      ).toBe(200)
      const tour = await publishTour(http, admin.headers, shop, "none")
      const types = (await blocksOf(tour.productId)).map((block) => block["@type"])
      expect(types).toEqual(["ProductGroup", "Event", "BreadcrumbList"])
    })

    it("writes no trip while the shop does not sell dated products, and keeps the page", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      await flag("catalog.booking", false)
      const types = (await blocksOf(tour.productId)).map((block) => block["@type"])
      expect(types).toEqual(["ProductGroup", "BreadcrumbList"])
    })

    it("leaves a dated product out of the shopping feeds, the others in", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      const goods = await stockedProduct(getContainer(), shop, "celik-tencere", 3)
      const items = await catalogItems(getContainer(), "https://ornek.com")
      const ids = items.map((item) => item.id)
      expect(ids).not.toContain(tour.adult)
      expect(ids).not.toContain(tour.infant)
      expect(ids).toContain(goods.variantId)
    })
  },
})
