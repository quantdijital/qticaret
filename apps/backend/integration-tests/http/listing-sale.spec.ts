import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createPriceListsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { SEO_REDIRECTS_MODULE } from "../../src/modules/seo-redirects"
import type SeoRedirectsModuleService from "../../src/modules/seo-redirects/service"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { landingKit } from "../helpers/landings"
import type { LandingKit } from "../helpers/landings"

jest.setTimeout(240 * 1000)

interface Listing {
  product_ids: string[]
  count: number
  facets: { attributes: { key: string }[]; price: { min: number; max: number } | null }
}

interface Resolved {
  type: string
  entity_type?: string
  entity_id?: string
  seo?: {
    title: string
    robots: string
    canonical: string | null
    jsonLd: Record<string, unknown>[]
  } | null
}

/** `/kampanyalar` (adr/0019 ek 2026-11-03): the products on sale now, as a listing of its own. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await settings().saveSection("seo", { canonical_host: null }, null)
    })

    const list = (query = "") =>
      settle(
        http.get<Listing & { message?: string }>(
          `/store/listings/products?${new URLSearchParams({
            type: "sale",
            id: "sale",
            region_id: kit.shop.regionId,
            currency_code: "try",
            query,
          }).toString()}`,
          { headers: kit.store.headers }
        )
      )

    const resolve = async (path: string) => {
      // A price list is no catalogue event: answers kept from before it are forgotten here,
      // as their 30 seconds would
      await getContainer()
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .invalidateResolutions()
      return (
        await http.get<Resolved>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: kit.store.headers,
        })
      ).data
    }

    async function variantOf(productId: string): Promise<string> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product_variant", fields: ["id"], filters: { product_id: productId } })
      return (data[0] as { id: string }).id
    }

    const onSale = async (productId: string, amount: number) =>
      createPriceListsWorkflow(getContainer()).run({
        input: {
          price_lists_data: [
            {
              title: `Kampanya ${String(amount)}`,
              description: "",
              status: "active",
              prices: [{ variant_id: await variantOf(productId), amount, currency_code: "try" }],
            },
          ],
        },
      })

    async function sitemapSite(): Promise<string> {
      const queued = await kit.post<{ async_job: { id: string } }>("/admin/async-jobs", {
        type: "seo.sitemap",
        input: {},
      })
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: { status: string } }>(
          `/admin/async-jobs/${queued.data.async_job.id}`,
          kit.admin
        )
        if (data.async_job.status === "succeeded") {
          const file = await http.get<string>("/store/seo/sitemaps/sitemap-site-1.xml", {
            headers: kit.store.headers,
            responseType: "text",
          })
          return file.data
        }
        await new Promise((done) => setTimeout(done, 100))
      }
      throw new Error("sitemap job did not succeed")
    }

    it("lists the products on a sale price list, not those at full price", async () => {
      const discounted = await kit.product("kupa-kampanya", { malzeme: "seramik", renk: ["mavi"] })
      const fullPrice = await kit.product("kupa-tam", { malzeme: "seramik", renk: ["mavi"] })
      await onSale(discounted, 80)

      const all = await list()
      expect(all.status).toBe(200)
      expect(all.data.product_ids).toEqual([discounted])
      expect(all.data.product_ids).not.toContain(fullPrice)
      expect(all.data.count).toBe(1)
      // The listing engine's filters and sorts, as every listing has them
      expect(all.data.facets.attributes.map((each) => each.key)).toContain("malzeme")
      expect(all.data.facets.price).toMatchObject({ min: 80, max: 80 })
      expect((await list("malzeme=porselen")).data.count).toBe(0)
      expect((await list("sirala=fiyat-artan")).data.product_ids).toEqual([discounted])

      const page = await resolve("/kampanyalar")
      expect(page).toMatchObject({ type: "entity", entity_type: "sale", entity_id: "sale" })
      expect(page.seo?.title.startsWith("Kampanyalı ürünler | ")).toBe(true)
      expect(page.seo?.robots).toBe("index,follow")
      expect(page.seo?.canonical).toBe("https://magaza.example.com/kampanyalar")
      expect(page.seo?.jsonLd[0]).toMatchObject({ "@type": "CollectionPage" })
      // A page past the last is not found, as any listing's
      expect((await resolve("/kampanyalar?sayfa=2")).type).toBe("not_found")

      expect(await sitemapSite()).toContain("<loc>https://magaza.example.com/kampanyalar</loc>")
    })

    it("keeps the page out of search and the sitemap while nothing is on sale", async () => {
      const empty = await list()
      expect([empty.status, empty.data.count, empty.data.product_ids]).toEqual([200, 0, []])

      const page = await resolve("/kampanyalar")
      expect(page).toMatchObject({ type: "entity", entity_type: "sale" })
      expect(page.seo?.robots).toBe("noindex,follow")

      expect(await sitemapSite()).not.toContain("/kampanyalar")
    })
  },
})
