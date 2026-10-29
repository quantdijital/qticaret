import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { googleFeedProblems } from "../../src/lib/feeds"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface FeedsStatus {
  enabled: boolean
  targets: { target: string; url: string | null; item_count: number | null }[]
}

/** F10.8 (adr/0038 §3; KK4): feeds from the page's own facts, behind a token. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }

    const status = async () =>
      (await http.get<{ feeds: FeedsStatus }>("/admin/marketing-feeds", { headers: admin.headers }))
        .data.feeds
    const pathOf = (feeds: FeedsStatus, target: string) => {
      const url = feeds.targets.find((each) => each.target === target)?.url ?? ""
      return url ? new URL(url).pathname : "/feeds/none/none"
    }
    const fetchFeed = (path: string) => settle(http.get<string>(path, { responseType: "text" }))

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    it("lists the product at the page's own price, in a feed Google's specification takes", async () => {
      const handle = `bardak-${String(Date.now())}`
      const { productId } = await stockedProduct(getContainer(), shop, handle, 5, 249.9)
      // Google and Meta take no item without an image
      await getContainer()
        .resolve(Modules.PRODUCT)
        .updateProducts(productId, { images: [{ url: "https://cdn.example.com/bardak.jpg" }] })
      await stockedProduct(getContainer(), shop, `tukenen-${String(Date.now())}`, 0, 99)
      await http.post("/admin/marketing-feeds/token", {}, { headers: admin.headers })
      await http.post("/admin/marketing-feeds/generate", {}, { headers: admin.headers })
      const feeds = await status()
      const google = await fetchFeed(pathOf(feeds, "google"))
      const meta = await fetchFeed(pathOf(feeds, "meta"))
      const page = await http.get<{ seo?: { jsonLd: Record<string, unknown>[] } }>(
        `/store/seo/resolve?path=${encodeURIComponent(`/urun/${handle}`)}`,
        { headers: storefront.headers }
      )
      const offer = page.data.seo?.jsonLd.find((block) => block["@type"] === "Product")?.[
        "offers"
      ] as { price: string } | undefined
      const listed =
        /<g:link>https:\/\/magaza\.example\.com\/urun\/bardak-[^<]+<\/g:link>[\s\S]*?<g:price>([^<]+)<\/g:price>/.exec(
          google.data
        )

      expect(feeds.enabled).toBe(true)
      expect(google.status).toBe(200)
      expect(google.headers["content-type"]).toContain("application/xml")
      expect(google.headers["x-robots-tag"]).toBe("noindex")
      expect(googleFeedProblems(google.data)).toEqual([])
      // KK4: the feed's price is the page's
      expect(listed?.[1]).toBe(`${offer?.price ?? "none"} TRY`)
      // Out of stock: left out
      expect(google.data).not.toContain("tukenen-")
      expect(meta.data.split("\n")[0]).toMatch(/^id,title,description,availability/)
      expect(google.data).toContain(
        "<g:image_link>https://cdn.example.com/bardak.jpg</g:image_link>"
      )
    })

    it("takes two builds at once, the schedule's and the panel's", async () => {
      await http.post("/admin/marketing-feeds/token", {}, { headers: admin.headers })
      const generate = () =>
        settle(http.post("/admin/marketing-feeds/generate", {}, { headers: admin.headers }))
      const both = await Promise.all([generate(), generate(), generate()])

      expect(both.map(({ status }) => status)).toEqual([200, 200, 200])
      expect((await status()).targets.every((each) => each.item_count !== null)).toBe(true)
    })

    it("opens nothing with a wrong or replaced token, nor once the feeds are off", async () => {
      await http.post("/admin/marketing-feeds/token", {}, { headers: admin.headers })
      await http.post("/admin/marketing-feeds/generate", {}, { headers: admin.headers })
      const first = pathOf(await status(), "google")
      await http.post("/admin/marketing-feeds/token", {}, { headers: admin.headers })
      await http.post("/admin/marketing-feeds/generate", {}, { headers: admin.headers })
      const second = pathOf(await status(), "google")
      const wrong = second.replace(/\/feeds\/[^/]+\//, "/feeds/yanlis-anahtar/")
      const unknownTarget = second.replace(/\/google$/, "/akakce")

      const replaced = await fetchFeed(first)
      const current = await fetchFeed(second)
      const guessed = await fetchFeed(wrong)
      const missing = await fetchFeed(unknownTarget)
      await http.delete("/admin/marketing-feeds/token", { headers: admin.headers })
      const off = await fetchFeed(second)

      expect(first).not.toBe(second)
      expect(replaced.status).toBe(404)
      expect(current.status).toBe(200)
      expect(guessed.status).toBe(404)
      expect(missing.status).toBe(404)
      expect(off.status).toBe(404)
      expect((await status()).enabled).toBe(false)
    })
  },
})
