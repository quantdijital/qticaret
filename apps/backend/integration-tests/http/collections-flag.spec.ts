import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { buildSitemap } from "../../src/workflows/seo/sitemap-build"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Answer {
  type: string
  entity_type?: string
}

/**
 * `catalog.collections` (on by default): off, collection writes are
 * refused as missing routes while reads stay, the Store API's collections
 * and the collection pages are not found and the sitemap lists none; on
 * again, everything is back, nothing was deleted.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const adminGet = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))
    const resolve = async (path: string) =>
      (
        await http.get<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const flag = (enabled: boolean) => post("/admin/features/catalog.collections", { enabled })
    const sitemapCollections = async () =>
      (await buildSitemap(getContainer()))?.files
        .filter((file) => file.name.includes("collections"))
        .map((file) => file.content)
        .join("\n") ?? ""

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    // Flags and settings live in a cache that outlives the database reset between tests
    afterEach(async () => {
      await settings().setFeature("catalog.collections", true, null)
      await settings().saveSection("seo", { canonical_host: null }, null)
    })

    it("is on by default and listed among the shop's features", async () => {
      const listed = await adminGet<{ features: { key: string; enabled: boolean }[] }>(
        "/admin/features"
      )
      expect(listed.data.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "catalog.collections", enabled: true, default: true }),
        ])
      )
    })

    it("takes collections off the shop while off and brings them back, records kept", async () => {
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const created = await post<{ collection: { id: string } }>("/admin/collections", {
        title: "Yaz Seçkisi",
      })
      const id = created.data.collection.id
      const board = await adminGet<{ live_count: number }>("/admin/collection-board")
      expect(board.data.live_count).toBe(1)
      expect(await resolve("/koleksiyon/yaz-seckisi")).toMatchObject({ type: "entity" })

      const off = await flag(false)
      expect(off.status).toBe(200)

      // Writes answer as missing routes; reads stay
      const create = await post("/admin/collections", { title: "Kış Seçkisi" })
      const update = await post(`/admin/collections/${id}`, { title: "Yaz" })
      const details = await post(`/admin/collections/${id}/details`, { description: "Yaz." })
      const removed = await settle(
        http.delete(`/admin/collections/${id}`, { headers: admin.headers })
      )
      expect([create.status, update.status, details.status, removed.status]).toEqual([
        404, 404, 404, 404,
      ])
      // Before any validator (an invalid body is 404, not 400), on every spelling of the path
      const invalid = await post("/admin/collections", {})
      const products = await post(`/admin/collections/${id}/products`, { add: [] })
      const trailing = await post(`/admin/collections/${id}/`, { title: "Yaz" })
      const upper = await post(`/admin/Collections/${id}`, { title: "Yaz" })
      expect([invalid.status, products.status, trailing.status, upper.status]).toEqual([
        404, 404, 404, 404,
      ])
      // Its SEO fields and the advisor's fixes are its writes too
      const seo = await settle(
        http.put(`/admin/seo/collection/${id}`, { seo_title: "Yaz" }, { headers: admin.headers })
      )
      const fix = await post(`/admin/seo/assessments/collection/${id}/fix`, {
        action: "use_template_title",
      })
      expect([seo.status, fix.status]).toEqual([404, 404])
      expect((await adminGet(`/admin/collections/${id}`)).status).toBe(200)
      expect((await adminGet(`/admin/collection-board/${id}`)).status).toBe(200)

      // The storefront: no page, no Store API collection, no listing, no sitemap entry
      expect(await resolve("/koleksiyon/yaz-seckisi")).toMatchObject({ type: "not_found" })
      expect((await storeGet(`/store/collections/${id}`)).status).toBe(404)
      expect((await storeGet("/store/collections")).status).toBe(404)
      expect((await storeGet(`/store/collections/${id}/details`)).status).toBe(404)
      const region = await getContainer()
        .resolve(Modules.REGION)
        .createRegions({ name: "Türkiye", currency_code: "try" })
      const listing = await storeGet(
        `/store/listings/products?${new URLSearchParams({
          type: "product_collection",
          id,
          region_id: region.id,
          currency_code: "try",
        }).toString()}`
      )
      expect(listing.status).toBe(404)
      // Products neither filter by a collection nor show one; its path is not given out
      const byCollection = await storeGet(`/store/products?collection_id=${id}`)
      const withCollection = await storeGet("/store/products?fields=id,*collection")
      const plain = await storeGet("/store/products?fields=id,title")
      expect([byCollection.status, withCollection.status, plain.status]).toEqual([400, 400, 200])
      const paths = await storeGet<{ paths: Record<string, string> }>(
        `/store/seo/paths?type=product_collection&id=${id}`
      )
      expect(paths.data.paths).toEqual({})
      expect(await sitemapCollections()).not.toContain("/koleksiyon/yaz-seckisi")
      const frame = await storeGet<{ features?: { collections?: boolean } }>("/store/storefront")
      expect(frame.data.features?.collections).toBe(false)

      // On again: everything is back, nothing was deleted
      await flag(true)
      expect(await resolve("/koleksiyon/yaz-seckisi")).toMatchObject({
        type: "entity",
        entity_type: "product_collection",
      })
      expect((await storeGet(`/store/collections/${id}`)).status).toBe(200)
      expect((await storeGet(`/store/products?collection_id=${id}`)).status).toBe(200)
      const back = await storeGet<{ paths: Record<string, string> }>(
        `/store/seo/paths?type=product_collection&id=${id}`
      )
      expect(back.data.paths).toEqual({ [id]: "/koleksiyon/yaz-seckisi" })
      const seoBack = await settle(
        http.put(`/admin/seo/collection/${id}`, { seo_title: "Yaz" }, { headers: admin.headers })
      )
      expect(seoBack.status).toBe(200)
      expect(await sitemapCollections()).toContain(
        "https://magaza.example.com/koleksiyon/yaz-seckisi"
      )
      expect((await post(`/admin/collections/${id}`, { title: "Yaz" })).status).toBe(200)
    })
  },
})
