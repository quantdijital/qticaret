import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import type { HttpClient } from "../helpers/http"
import { doc, landingKit, words } from "../helpers/landings"
import type { Answer, Landing, LandingKit } from "../helpers/landings"

jest.setTimeout(180 * 1000)

interface Listed extends Answer {
  listing?: { filters: Record<string, string[]>; page: number; page_size: number }
  seo?: Answer["seo"] & { robots: string; canonical: string | null }
}

const CATEGORY = "/kategori/ev-ve-yasam"
const HOST = "https://magaza.example.com"

/**
 * F3.17 (docs/13 §3, §7): numbered pages, brand filters, landing pages
 * reached in one hop, and listings other than categories.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit
    const resolve = (path: string) => kit.resolve(path) as Promise<Listed>
    const publish = (value: string, body: Record<string, unknown> = {}) =>
      kit.post<{ landing: Landing }>("/admin/landings", {
        category_id: kit.categoryId,
        facet: { kind: "attribute", key: "malzeme", value },
        title: `${value} kupalar`,
        status: "published",
        body: doc(words(value, 320)),
        ...body,
      })

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    it("names a numbered page canonical, and finds none past the last", async () => {
      // 4 cups and 21 more: two pages of 24
      await createProductsWorkflow(getContainer()).run({
        input: {
          products: Array.from({ length: 21 }, (_, index) => ({
            title: `Tabak ${String(index)}`,
            handle: `tabak-${String(index)}`,
            status: "published" as const,
            weight: 500,
            length: 20,
            width: 20,
            height: 2,
            shipping_profile_id: kit.shop.shippingProfileId,
            category_ids: [kit.categoryId],
            options: [{ title: "Seçenek", values: ["Standart"] }],
            variants: [{ title: "Standart", options: { Seçenek: "Standart" }, prices: [] }],
          })),
        },
      })
      const second = await resolve(`${CATEGORY}?sayfa=2`)
      expect(second).toMatchObject({
        type: "entity",
        listing: { page: 2, page_size: 24 },
        seo: { robots: "index,follow", canonical: `${HOST}${CATEGORY}?sayfa=2` },
      })
      expect(second.seo?.title).toContain(" - Sayfa 2")
      expect((await resolve(`${CATEGORY}?sayfa=3`)).type).toBe("not_found")
    })

    it("filters by brand, and sends a brand with a landing page there", async () => {
      const brand = (
        await kit.post<{ brand: { id: string } }>("/admin/brands", {
          name: "Örnek Atölye",
          is_active: true,
        })
      ).data.brand
      const cup = await kit.product("kupa-atolye", { malzeme: "seramik" })
      await kit.post(`/admin/products/${cup}/brand`, { brand_id: brand.id })
      expect(await resolve(`${CATEGORY}?marka=ornek-atolye`)).toMatchObject({
        type: "entity",
        listing: { filters: { marka: ["ornek-atolye"] } },
      })

      await kit.post("/admin/landings", {
        category_id: kit.categoryId,
        facet: { kind: "brand", key: "marka", value: brand.id },
        title: "Örnek Atölye kupaları",
        status: "published",
        body: doc(words("atolye", 320)),
      })
      expect(await resolve(`${CATEGORY}?marka=ornek-atolye&sayfa=2`)).toMatchObject({
        type: "redirect",
        location: `${CATEGORY}/ornek-atolye?sayfa=2`,
      })
    })

    it("reaches a landing page in one hop, and never a draft one", async () => {
      await publish("seramik", { status: "draft" })
      expect((await resolve(`${CATEGORY}?malzeme=seramik`)).type).toBe("entity")

      await publish("porselen")
      // Not canonical (upper case) and tracked: still one 301, to the landing page
      expect(await resolve(`${CATEGORY}?malzeme=Porselen&utm_source=x`)).toMatchObject({
        type: "redirect",
        status: 301,
        location: `${CATEGORY}/porselen?utm_source=x`,
      })
      // A rule that ends on the filtered listing goes straight on too
      await kit.post("/admin/seo/redirects", {
        source: "/eski-porselen",
        target: `${CATEGORY}?malzeme=porselen`,
      })
      expect(await resolve("/eski-porselen")).toMatchObject({
        type: "redirect",
        location: `${CATEGORY}/porselen`,
      })
    })

    it("reads the query of a collection and of a landing page alike", async () => {
      await kit.post("/admin/collections", { title: "Yaz Seçkisi" })
      expect(await resolve("/koleksiyon/yaz-seckisi?sirala=yeni")).toMatchObject({
        type: "entity",
        seo: { robots: "noindex,follow", canonical: `${HOST}/koleksiyon/yaz-seckisi` },
      })

      await publish("seramik")
      expect(await resolve(`${CATEGORY}/seramik?sirala=fiyat-artan`)).toMatchObject({
        type: "entity",
        entity_type: "landing",
        seo: { robots: "noindex,follow", canonical: `${HOST}${CATEGORY}/seramik` },
      })
      expect((await resolve(`${CATEGORY}/seramik?renk=kirmizi,mavi&sayfa=2`)).type).toBe(
        "not_found"
      )
    })
  },
})
