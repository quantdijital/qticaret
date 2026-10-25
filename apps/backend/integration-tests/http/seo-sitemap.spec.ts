import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

const product = (title: string) => ({
  title,
  status: "published",
  weight: 250,
  length: 30,
  width: 5,
  height: 2,
  options: [{ title: "Boyut", values: ["Standart"] }],
  variants: [
    {
      title: "Standart",
      options: { Boyut: "Standart" },
      manage_inventory: false,
      prices: [{ currency_code: "try", amount: 1000 }],
    },
  ],
})

/** F3.6, F3.15 (docs/13 §6, §9): the sitemap job, its files and robots.txt. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const storeText = (url: string) =>
      settle(http.get<string>(url, { headers: store.headers, responseType: "text" }))
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    async function runSitemap(): Promise<Job> {
      const queued = await post<{ async_job: Job }>("/admin/async-jobs", {
        type: "seo.sitemap",
        input: {},
      })
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(
          `/admin/async-jobs/${queued.data.async_job.id}`,
          { headers: admin.headers }
        )
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    // The settings cache outlives the database reset between tests: always set back
    afterEach(async () => {
      await settings().saveSection(
        "seo",
        { canonical_host: null, ai_crawler_preset: "ai_search_visible" },
        null
      )
    })

    it("lists live, indexable pages at their paths and indexes the files", async () => {
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await post("/admin/products", product("Keten Gömlek"))
      const hidden = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Gizli Ürün")
      )
      await http.put(
        `/admin/seo/product/${hidden.data.product.id}`,
        { robots_override: "noindex_follow" },
        { headers: admin.headers }
      )
      await post("/admin/products", { ...product("Taslak"), status: "draft" })
      await post("/admin/product-categories", { name: "Giyim", is_active: true })

      const job = await runSitemap()
      expect(job).toMatchObject({ status: "succeeded", result_summary: { urls: 2 } })

      const index = await storeText("/store/seo/sitemaps/sitemap.xml")
      expect(index.headers["content-type"]).toContain("application/xml")
      expect(index.data).toContain("<loc>https://magaza.example.com/sitemap-products-1.xml</loc>")
      expect(index.data).toContain("<loc>https://magaza.example.com/sitemap-categories-1.xml</loc>")
      const products = await storeText("/store/seo/sitemaps/sitemap-products-1.xml")
      expect(products.data).toContain("<loc>https://magaza.example.com/urun/keten-gomlek</loc>")
      expect(products.data).not.toContain("gizli-urun")
      expect(products.data).not.toContain("taslak")

      expect((await storeText("/store/seo/sitemaps/sitemap-x.xml")).status).toBe(404)
      expect((await storeText("/store/seo/sitemaps/..%2F.env")).status).toBe(404)

      const { data: state } = await http.get<{ files: { name: string }[]; dirty_since: unknown }>(
        "/admin/seo/sitemap",
        { headers: admin.headers }
      )
      expect(state.files.map(({ name }) => name)).toEqual([
        "sitemap-categories-1.xml",
        "sitemap-products-1.xml",
        "sitemap.xml",
      ])
    })

    it("builds nothing without a canonical host", async () => {
      await post("/admin/products", product("Keten Gömlek"))
      const job = await runSitemap()
      expect(job.result_summary).toMatchObject({ host_missing: true })
      expect((await storeText("/store/seo/sitemaps/sitemap.xml")).status).toBe(404)
    })

    it("serves robots.txt with the sitemap and the AI preset, as plain text", async () => {
      await settings().saveSection(
        "seo",
        { canonical_host: "magaza.example.com", ai_crawler_preset: "block_training" },
        null
      )
      const robots = await storeText("/store/seo/robots")
      expect(robots.headers["content-type"]).toContain("text/plain")
      expect(robots.headers["x-content-type-options"]).toBe("nosniff")
      expect(robots.data).toContain("Sitemap: https://magaza.example.com/sitemap.xml")
      expect(robots.data).toContain("User-agent: GPTBot")
      expect(robots.data).toContain("Disallow: /sepet")
    })
  },
})
