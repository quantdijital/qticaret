import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SEO_REDIRECTS_MODULE } from "../../src/modules/seo-redirects"
import type SeoRedirectsModuleService from "../../src/modules/seo-redirects/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Resolution {
  type: string
  status?: number
  location?: string
  entity_id?: string
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

/**
 * F3.5 (docs/13 §2.4, §4): old paths of records answer from the URL
 * registry (a renamed product, a successor, a 410), the storefront's
 * resolve and 404 report, hit counts and target suggestions.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const create = async (title: string) =>
      (await post<{ product: { id: string } }>("/admin/products", product(title))).data.product.id
    const resolve = async (path: string) =>
      (
        await http.get<Resolution>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data
    const redirects = () => getContainer().resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)

    // Deletions release their paths in a subscriber, after the request answers
    async function settled(path: string, type: string): Promise<Resolution> {
      let answer = await resolve(path)
      for (let attempt = 0; attempt < 30 && answer.type !== type; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        answer = await resolve(path)
      }
      return answer
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("gives the storefront each record's current path for its links (adr/0046 §3)", async () => {
      const kept = await create("Keten Masa Örtüsü")
      const renamed = await create("Bambu Tabak")
      await post(`/admin/products/${renamed}`, { handle: "bambu-servis-tabagi" })

      const answer = await http.get<{ paths: Record<string, string> }>(
        `/store/seo/paths?type=product&id=${kept}&id=${renamed}&id=prod_unknown`,
        { headers: store.headers }
      )

      expect(answer.data.paths).toEqual({
        [kept]: "/urun/keten-masa-ortusu",
        [renamed]: "/urun/bambu-servis-tabagi",
      })
      expect(answer.headers["cache-control"]).toContain("max-age=60")
      const single = await http.get<{ paths: Record<string, string> }>(
        `/store/seo/paths?type=product&id=${kept}`,
        { headers: store.headers }
      )
      expect(single.data.paths).toEqual({ [kept]: "/urun/keten-masa-ortusu" })

      const tooMany = Array.from({ length: 101 }, (_, index) => `id=prod_${String(index)}`).join(
        "&"
      )
      for (const query of ["type=customer&id=cus_1", "type=product", `type=product&${tooMany}`]) {
        const refused = await settle(
          http.get(`/store/seo/paths?${query}`, { headers: store.headers })
        )
        expect(refused.status).toBe(400)
      }
    })

    it("sends a renamed product's old path to its new one, cacheable for a minute", async () => {
      const id = await create("Seramik Kupa")
      await post(`/admin/products/${id}`, { handle: "el-yapimi-seramik-kupa" })

      const answer = await http.get<Resolution>(
        "/store/seo/resolve?path=/urun/seramik-kupa?ref=x",
        {
          headers: store.headers,
        }
      )
      expect(answer.data).toEqual({
        type: "redirect",
        path: "/urun/seramik-kupa",
        status: 301,
        location: "/urun/el-yapimi-seramik-kupa?ref=x",
      })
      expect(answer.headers["cache-control"]).toContain("max-age=60")
      expect(await resolve("/urun/el-yapimi-seramik-kupa")).toMatchObject({
        type: "entity",
        entity_id: id,
      })
    })

    it("sends a deleted product to its successor, a 410 without one, and frees a released path", async () => {
      const kupa = await create("Seramik Kupa")
      const gomlek = await create("Keten Gömlek")
      await post(`/admin/products/${kupa}/catalog`, { successor_product_id: gomlek })

      await http.delete(`/admin/products/${kupa}`, { headers: admin.headers })
      expect(await settled("/urun/seramik-kupa", "redirect")).toMatchObject({
        status: 301,
        location: "/urun/keten-gomlek",
      })

      await http.delete(`/admin/products/${gomlek}`, { headers: admin.headers })
      expect(await settled("/urun/keten-gomlek", "gone")).toMatchObject({ type: "gone" })
      expect(await resolve("/urun/seramik-kupa")).toMatchObject({ type: "gone" })

      const listed = await http.get<{ paths: { path: string; answer: string; name: string }[] }>(
        "/admin/seo/old-paths?q=gomlek",
        { headers: admin.headers }
      )
      expect(listed.data.paths).toEqual([
        expect.objectContaining({
          path: "/urun/keten-gomlek",
          answer: "gone",
          name: "Keten Gömlek",
        }),
      ])

      const live = await post("/admin/seo/old-paths/release", { path: "/urun/yok" })
      expect(live.status).toBe(404)
      const released = await post("/admin/seo/old-paths/release", { path: "/urun/keten-gomlek" })
      expect(released.status).toBe(200)
      expect(await resolve("/urun/keten-gomlek")).toMatchObject({ type: "not_found" })
      expect((await post("/admin/products", product("Keten Gömlek"))).status).toBe(200)
    })

    it("refuses to release a path a record uses", async () => {
      await create("Seramik Kupa")
      const used = await post("/admin/seo/old-paths/release", { path: "/urun/seramik-kupa" })
      expect(used.status).toBe(400)
      expect(used.data.message).toBe("seo.path_active")
    })

    it("logs reported 404s by host only, skips live pages and suggests a target", async () => {
      await create("Seramik Kupa")
      const report = (path: string, referrer?: string) =>
        settle(http.post("/store/seo/not-found", { path, referrer }, { headers: store.headers }))

      expect(
        (await report("/urun/seramik-kupaa", "https://google.com/search?q=gizli")).status
      ).toBe(204)
      await report("/urun/seramik-kupaa")
      await report("/urun/seramik-kupa")
      // Personal data in a path keeps it out of the log
      await report("/siparis/ali.veli@ornek.com")
      await redirects().flushCounters()

      const { data } = await http.get<{
        entries: {
          path: string
          hits: number
          last_referer_host: string | null
          suggestions: { path: string }[]
        }[]
      }>("/admin/seo/not-found", { headers: admin.headers })
      expect(data.entries).toEqual([
        expect.objectContaining({
          path: "/urun/seramik-kupaa",
          hits: 2,
          last_referer_host: "google.com",
          suggestions: [expect.objectContaining({ path: "/urun/seramik-kupa" })],
        }),
      ])
      expect(JSON.stringify(data)).not.toContain("gizli")
    })

    it("counts the hits a rule answers, not the tries in the panel", async () => {
      await create("Seramik Kupa")
      await post("/admin/seo/redirects", { source: "/eski", target: "/urun/seramik-kupa" })
      await resolve("/eski")
      await resolve("/eski")
      await http.get("/admin/seo/resolve?path=/eski", { headers: admin.headers })
      await redirects().flushCounters()

      const { data } = await http.get<{ redirects: { hit_count: number }[] }>(
        "/admin/seo/redirects",
        { headers: admin.headers }
      )
      expect(data.redirects[0]?.hit_count).toBe(2)
    })

    it("needs the publishable key on the Store API", async () => {
      const bare = await settle(http.get("/store/seo/resolve?path=/x"))
      expect(bare.status).toBe(400)
    })
  },
})
