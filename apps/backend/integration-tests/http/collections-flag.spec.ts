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
      expect(await sitemapCollections()).toContain(
        "https://magaza.example.com/koleksiyon/yaz-seckisi"
      )
      expect((await post(`/admin/collections/${id}`, { title: "Yaz" })).status).toBe(200)
    })
  },
})
