import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { isCrawlable, parseRobots } from "../../src/lib/seo/robots-match"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import type { HttpClient } from "../helpers/http"
import { doc, landingKit, words } from "../helpers/landings"
import type { Answer, LandingKit } from "../helpers/landings"

jest.setTimeout(180 * 1000)

interface Listed extends Answer {
  listing?: { filters: Record<string, string[]>; sort: string | null; page: number }
  seo?: Answer["seo"] & { robots: string; canonical: string | null }
}

const CATEGORY = "/kategori/ev-ve-yasam"

/**
 * F3.17 (docs/13 §3, §7): a listing's filters in one canonical form, a
 * single facet with a landing page sent there, empty combinations not
 * found, filtered pages out of the index and robots.txt keeping crawlers
 * off them (KK) but not off landing pages.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit
    const resolve = (path: string) => kit.resolve(path) as Promise<Listed>

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    it("puts a listing's filters in canonical order with one 301", async () => {
      expect(await resolve(`${CATEGORY}?renk=mavi&utm_source=x&malzeme=seramik`)).toMatchObject({
        type: "redirect",
        status: 301,
        location: `${CATEGORY}?malzeme=seramik&renk=mavi&utm_source=x`,
      })
      expect(await resolve(`${CATEGORY}?sayfa=1`)).toMatchObject({
        type: "redirect",
        location: CATEGORY,
      })
    })

    it("keeps a filtered or sorted listing out of the index, its canonical the clean page", async () => {
      const filtered = await resolve(`${CATEGORY}?malzeme=seramik&renk=mavi`)
      expect(filtered).toMatchObject({
        type: "entity",
        entity_type: "product_category",
        listing: { filters: { malzeme: ["seramik"], renk: ["mavi"] }, sort: null, page: 1 },
        seo: {
          robots: "noindex,follow",
          canonical: `https://magaza.example.com${CATEGORY}`,
        },
      })
      const sorted = await resolve(`${CATEGORY}?sirala=fiyat-artan`)
      expect(sorted).toMatchObject({
        listing: { sort: "fiyat-artan" },
        seo: { robots: "noindex,follow" },
      })
      // Tracking parameters are no listing's: the page is the page
      const plain = await resolve(`${CATEGORY}?utm_source=x`)
      expect(plain.seo?.robots).toBe("index,follow")
      expect(plain.listing).toBeUndefined()
    })

    it.each([
      ["a combination no product has", "?malzeme=porselen&renk=kirmizi"],
      ["a brand the shop does not have", "?marka=yok-boyle-marka"],
      ["a page past the last", "?sayfa=2"],
      [
        "more filters than a page takes",
        `?renk=${Array.from({ length: 11 }, (_, i) => `r${String(i)}`).join(",")}`,
      ],
    ])("answers not found for %s", async (_label, search) => {
      expect((await resolve(`${CATEGORY}${search}`)).type).toBe("not_found")
    })

    it("sends a single facet with a live landing page to it", async () => {
      await kit.landing("seramik", {
        title: "Seramik kupalar",
        status: "published",
        body: doc(words("seramik", 320)),
      })
      expect(await resolve(`${CATEGORY}?malzeme=seramik&utm_source=x`)).toMatchObject({
        type: "redirect",
        status: 301,
        location: `${CATEGORY}/seramik?utm_source=x`,
      })
      // Two facets are no landing page's
      expect((await resolve(`${CATEGORY}?malzeme=seramik&renk=mavi`)).type).toBe("entity")
    })

    it("keeps crawlers off filtered listings but not off landing pages (KK)", async () => {
      const { data } = await http.get<string>("/store/seo/robots", {
        headers: kit.store.headers,
        responseType: "text",
      })
      expect(data).toContain("Disallow: /*?malzeme=")
      expect(data).toContain("Disallow: /*&renk=")
      const robots = parseRobots(data)
      expect(isCrawlable(robots, "*", `${CATEGORY}?malzeme=seramik`)).toBe(false)
      expect(isCrawlable(robots, "*", `${CATEGORY}?sayfa=2&sirala=yeni`)).toBe(false)
      expect(isCrawlable(robots, "*", `${CATEGORY}/seramik`)).toBe(true)
      expect(isCrawlable(robots, "*", `${CATEGORY}?sayfa=2`)).toBe(true)

      const site = await http.get<{ system_pages: { path: string; robots: string }[] }>(
        "/store/seo/site",
        { headers: kit.store.headers }
      )
      expect(site.data.system_pages).toContainEqual({ path: "/arama", robots: "noindex,follow" })
    })
  },
})
