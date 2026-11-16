import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { parseEnv, storefrontOrigin } from "../../src/lib/env"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface SeoAnswer {
  section: string
  values: { canonical_host: string | null } & Record<string, unknown>
  storefront_url?: string | null
  message?: string
}

/**
 * The storefront's address the panel's "Mağazayı görüntüle" opens (the
 * owner, 2026-11-16): the backend says it beside the SEO settings, from
 * the bound domain else its own configured origin; read only, staff only,
 * never in the Store API.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const getSeo = (headers: Record<string, string>) =>
      settle(http.get<SeoAnswer>("/admin/platform-settings/seo", { headers }))
    const postSeo = (body: unknown) =>
      settle(http.post<SeoAnswer>("/admin/platform-settings/seo", body, admin))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("gives the configured storefront while no domain is bound, then the bound domain", async () => {
      const before = await getSeo(admin.headers)
      expect(before.status).toBe(200)
      expect(before.data.values.canonical_host).toBeNull()
      // The environment's origin (localhost:8000 under test when unset): never made up here
      const configured = storefrontOrigin(parseEnv())
      expect(configured).toMatch(/^https?:\/\/[^/]+$/)
      expect(before.data.storefront_url).toBe(configured)

      const saved = await postSeo({ canonical_host: "magaza.example.com" })
      expect(saved.status).toBe(200)
      expect(saved.data.storefront_url).toBe("https://magaza.example.com")
      const after = await getSeo(admin.headers)
      expect(after.data.storefront_url).toBe("https://magaza.example.com")
    })

    it("cannot be written: a save that sends it is refused and changes nothing", async () => {
      for (const body of [
        { storefront_url: "https://kotu.example" },
        { canonical_host: "magaza.example.com", storefront_url: "https://kotu.example" },
      ]) {
        const refused = await postSeo(body)
        expect(refused.status).toBe(400)
      }
      const after = await getSeo(admin.headers)
      expect(after.data.values.canonical_host).toBeNull()
      expect(after.data.values).not.toHaveProperty("storefront_url")
      expect(after.data.storefront_url).toBe(storefrontOrigin(parseEnv()))
    })

    it("is for signed-in staff only, and only beside the SEO settings", async () => {
      const anonymous = await getSeo({})
      expect(anonymous.status).toBe(401)
      expect(anonymous.data.storefront_url).toBeUndefined()

      const store = await settle(
        http.get<Record<string, unknown>>("/admin/platform-settings/store", admin)
      )
      expect(store.status).toBe(200)
      expect(store.data).not.toHaveProperty("storefront_url")

      // The Store API's site answer names no such address
      const shop = await createStorefront(getContainer())
      const site = await settle(
        http.get<Record<string, unknown>>("/store/seo/site", { headers: shop.headers })
      )
      expect(site.status).toBe(200)
      expect(JSON.stringify(site.data)).not.toContain("storefront_url")
    })
  },
})
