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
  error_code: string | null
  result_summary: Record<string, unknown> | null
}

interface Category {
  id: string
  handle: string
}

const draft = (title: string) => ({
  title,
  status: "draft",
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

const PREFIXED = { product: "prefixed", category: "prefixed", brand: "prefixed" }
const NESTED = { ...PREFIXED, category: "nested" }

/**
 * The categories' nested URL style (adr/0017 Ek 2026-11-23): the tree
 * without `/kategori`, moved to by the style job with 301s from the old
 * paths, and refused where it would collide.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const category = async (name: string, parent?: string) =>
      (
        await post<{ product_category: Category }>("/admin/product-categories", {
          name,
          is_active: true,
          ...(parent ? { parent_category_id: parent } : {}),
        })
      ).data.product_category
    const resolve = async (path: string) =>
      (
        await http.get<{ type: string; entity_id?: string; location?: string; status?: number }>(
          `/store/seo/resolve?path=${encodeURIComponent(path)}`,
          { headers: store.headers }
        )
      ).data
    const check = async (styles: Record<string, string>) =>
      (
        await http.get<{
          moves: number
          conflicts: { path: string; reason: string; records: { name: string }[] }[]
        }>(`/admin/seo/url-style?${new URLSearchParams(styles).toString()}`, {
          headers: admin.headers,
        })
      ).data

    async function settled(id: string): Promise<Job> {
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: admin.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }
    const runJob = async (type: string, input: unknown) =>
      settled(
        (await post<{ async_job: Job }>("/admin/async-jobs", { type, input })).data.async_job.id
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    // The settings cache outlives the database reset between tests: always set back
    afterEach(async () => {
      await settings().saveSection("seo", { url_style: PREFIXED, canonical_host: null }, null)
    })

    it("moves the categories to the nested style; the old paths answer with a 301", async () => {
      const root = await category("Hediyelik Eşyalar")
      const child = await category("Çakı Kutusu", root.id)

      expect(await check(NESTED)).toMatchObject({ moves: 2, conflicts: [] })
      const job = await runJob("seo.url_style", NESTED)

      expect(job).toMatchObject({ status: "succeeded", result_summary: { moved: 2 } })
      expect(await resolve("/hediyelik-esyalar/caki-kutusu")).toMatchObject({
        type: "entity",
        entity_id: child.id,
      })
      expect(await resolve("/kategori/hediyelik-esyalar/caki-kutusu")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/hediyelik-esyalar/caki-kutusu",
      })
      expect(await resolve("/kategori/hediyelik-esyalar")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/hediyelik-esyalar",
      })
      const { data } = await http.get<{ values: { url_style: Record<string, string> } }>(
        "/admin/platform-settings/seo",
        { headers: admin.headers }
      )
      expect(data.values.url_style).toEqual(NESTED)
    })

    it("gives a new subcategory its tree and moves the subtree when a parent is renamed", async () => {
      await settings().saveSection("seo", { url_style: NESTED }, null)
      const root = await category("Hediyelik Eşyalar")
      const child = await category("Çakı Kutusu", root.id)
      expect(await resolve("/hediyelik-esyalar/caki-kutusu")).toMatchObject({ type: "entity" })

      const renamed = await post(`/admin/product-categories/${root.id}`, { handle: "hediyelik" })

      expect(renamed.status).toBe(200)
      expect(await resolve("/hediyelik/caki-kutusu")).toMatchObject({
        type: "entity",
        entity_id: child.id,
      })
      expect(await resolve("/hediyelik-esyalar/caki-kutusu")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/hediyelik/caki-kutusu",
      })
    })

    it("lists the sitemap's categories at their nested paths", async () => {
      await settings().saveSection(
        "seo",
        { url_style: NESTED, canonical_host: "magaza.example.com" },
        null
      )
      const root = await category("Hediyelik Eşyalar")
      await category("Çakı Kutusu", root.id)

      expect(await runJob("seo.sitemap", {})).toMatchObject({ status: "succeeded" })
      const file = await settle(
        http.get<string>("/store/seo/sitemaps/sitemap-categories-1.xml", {
          headers: store.headers,
          responseType: "text",
        })
      )
      expect(file.data).toContain(
        "<loc>https://magaza.example.com/hediyelik-esyalar/caki-kutusu</loc>"
      )
      expect(file.data).not.toContain("/kategori/")
    })

    it("lists what stands in the way: a root word the storefront keeps, a path another record holds", async () => {
      // `/kategori/sepet` is a category's; without the prefix it is the basket page's
      const basket = await category("Sepet")
      await category("İndirim", basket.id)
      await post("/admin/products", draft("Çakı Kutusu"))
      await category("Çakı Kutusu")

      const nested = await check(NESTED)
      expect(nested.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "/sepet", reason: "reserved_root" }),
          expect.objectContaining({ path: "/sepet/indirim", reason: "reserved_root" }),
        ])
      )
      const both = await check({ ...NESTED, product: "flat" })
      expect(both.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "/caki-kutusu", reason: "shared" }),
        ])
      )
      const job = await runJob("seo.url_style", NESTED)
      expect(job).toMatchObject({ status: "failed", error_code: "seo.url_style_conflicts" })
      expect(await resolve("/kategori/sepet/indirim")).toMatchObject({ type: "entity" })
    })

    it("refuses a nested category on a path another record or the storefront holds", async () => {
      await settings().saveSection("seo", { url_style: { ...NESTED, product: "flat" } }, null)
      await post("/admin/products", draft("Kamp"))

      const taken = await post("/admin/product-categories", { name: "Kamp", is_active: true })
      const reserved = await post("/admin/product-categories", { name: "Sepet", is_active: true })

      expect(taken.status).toBe(400)
      expect(taken.data.message).toBe("seo.path_taken")
      expect(reserved.status).toBe(400)
      expect(reserved.data.message).toBe("seo.path_reserved")
    })
  },
})
