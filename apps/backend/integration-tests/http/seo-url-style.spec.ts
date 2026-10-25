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

const FLAT_PRODUCTS = { product: "flat", category: "prefixed", brand: "prefixed" }
const PREFIXED = { product: "prefixed", category: "prefixed", brand: "prefixed" }

/** F3 T4 (docs/13 §2.2): a URL style change is checked, then moves every path in a job. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const resolve = async (path: string) =>
      (
        await http.get<{ type: string; location?: string; status?: number }>(
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

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    // The settings cache outlives the database reset between tests: always set back
    afterEach(async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { url_style: PREFIXED }, null)
    })

    it("refuses a style change through the settings and lists what stands in the way", async () => {
      await post("/admin/products", product("Giyim"))
      await post("/admin/product-categories", { name: "Giyim", is_active: true })

      const direct = await post("/admin/platform-settings/seo", { url_style: FLAT_PRODUCTS })
      expect(direct.status).toBe(400)
      expect(direct.data.message).toBe("seo.url_style_job_required")
      expect((await post("/admin/platform-settings/seo", { url_style: PREFIXED })).status).toBe(200)

      expect(await check(FLAT_PRODUCTS)).toMatchObject({ moves: 1, conflicts: [] })
      const both = await check({ ...FLAT_PRODUCTS, category: "flat" })
      expect(both.conflicts).toEqual([
        expect.objectContaining({ path: "/giyim", reason: "shared" }),
      ])
    })

    it("moves every product in a job, then the old paths answer with a 301", async () => {
      await post("/admin/products", product("Keten Gömlek"))
      await post("/admin/products", product("Seramik Kupa"))

      const queued = await post<{ async_job: Job }>("/admin/async-jobs", {
        type: "seo.url_style",
        input: FLAT_PRODUCTS,
      })
      const job = await settled(queued.data.async_job.id)

      expect(job).toMatchObject({ status: "succeeded", result_summary: { moved: 2 } })
      expect(await resolve("/keten-gomlek")).toMatchObject({ type: "entity" })
      expect(await resolve("/urun/keten-gomlek")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/keten-gomlek",
      })
      const { data } = await http.get<{ values: { url_style: Record<string, string> } }>(
        "/admin/platform-settings/seo",
        { headers: admin.headers }
      )
      expect(data.values.url_style).toEqual(FLAT_PRODUCTS)
    })

    it("fails the job, moving nothing, when a conflict appeared after the check", async () => {
      await post("/admin/products", product("Sepet"))
      const queued = await post<{ async_job: Job }>("/admin/async-jobs", {
        type: "seo.url_style",
        input: FLAT_PRODUCTS,
      })
      const job = await settled(queued.data.async_job.id)

      expect(job).toMatchObject({ status: "failed", error_code: "seo.url_style_conflicts" })
      expect(await resolve("/urun/sepet")).toMatchObject({ type: "entity" })
    })
  },
})
