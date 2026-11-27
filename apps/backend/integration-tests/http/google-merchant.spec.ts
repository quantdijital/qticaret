import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGoogle } from "@qticaret/testing"
import type { FakeGoogle } from "@qticaret/testing"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface GoogleStatus {
  configured: boolean
  connected: boolean
  email: string | null
  merchant_id: string | null
}

interface SyncResult {
  sent: number
  removed: number
  failed: number
  error: string | null
  ran: boolean
}

const ENV = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_BASE_URL"] as const

/** F10 M13 (adr/0038 §3, §5): the shop's Google account, and its products in Merchant Center. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    // The test server's own address: the callback is read without following its redirect
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let google: FakeGoogle
    let shop: StockShop
    let admin: { headers: Record<string, string> }

    const status = async () =>
      (await http.get<{ google: GoogleStatus }>("/admin/google", { headers: admin.headers })).data
        .google
    /** Google's redirect back, in the staff member's browser: their session goes with it. */
    const callback = async (path: string, headers: Record<string, string> = admin.headers) => {
      const answer = await fetch(`${base()}${path}`, { redirect: "manual", headers })
      return { status: answer.status, location: answer.headers.get("location") ?? "" }
    }
    const consentPath = async (answer: "allow" | "deny" = "allow") => {
      const { data } = await http.post<{ url: string }>(
        "/admin/google/connect",
        {},
        { headers: admin.headers }
      )
      const back = new URL(await google.consent(data.url, answer))
      return `${back.pathname}${back.search}`
    }
    const connect = async () => callback(await consentPath())
    const sync = async () =>
      (
        await http.post<{ sync: SyncResult }>(
          "/admin/google/merchant/sync",
          {},
          { headers: admin.headers }
        )
      ).data.sync
    const product = async (handle: string) => {
      const { productId, variantId } = await stockedProduct(getContainer(), shop, handle, 5, 249.9)
      await getContainer()
        .resolve(Modules.PRODUCT)
        .updateProducts(productId, { images: [{ url: `https://cdn.example.com/${handle}.jpg` }] })
      return { productId, variantId }
    }

    beforeAll(async () => {
      google = await startFakeGoogle()
      Object.assign(process.env, {
        GOOGLE_OAUTH_CLIENT_ID: google.client.clientId,
        GOOGLE_OAUTH_CLIENT_SECRET: google.client.clientSecret,
        GOOGLE_BASE_URL: google.url,
      })
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await google.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    it("connects the shop's Google account through state and PKCE, each used once", async () => {
      // Google comes back to the panel's origin, where the staff member's session is
      // (adr/0022 §4): the dev server's locally, the shop's one host once set
      const backend = process.env["BACKEND_URL"]
      const redirectUri = async () => {
        const { data } = await http.post<{ url: string }>(
          "/admin/google/connect",
          {},
          { headers: admin.headers }
        )
        return new URL(data.url).searchParams.get("redirect_uri")
      }
      try {
        Reflect.deleteProperty(process.env, "BACKEND_URL")
        expect(await redirectUri()).toBe("http://localhost:5173/google/callback")
        process.env["BACKEND_URL"] = "https://magaza.example.com"
        expect(await redirectUri()).toBe("https://magaza.example.com/google/callback")
      } finally {
        if (backend === undefined) {
          Reflect.deleteProperty(process.env, "BACKEND_URL")
        } else {
          process.env["BACKEND_URL"] = backend
        }
      }
      // Someone else holding the address, without the staff member's session, finishes nothing
      const stranger = await callback(await consentPath(), {})
      const path = await consentPath()
      const connected = await callback(path)
      const replayed = await callback(path)
      const denied = await callback(await consentPath("deny"))
      const after = await status()
      const raw = await http.get("/admin/google", { headers: admin.headers })

      expect(stranger.location).toBe("/settings/marketing?google=state_invalid")
      expect(connected).toEqual({ status: 303, location: "/settings/marketing?google=connected" })
      expect(replayed.location).toBe("/settings/marketing?google=state_invalid")
      expect(denied.location).toBe("/settings/marketing?google=denied")
      expect(after).toMatchObject({ configured: true, connected: true, email: google.email })
      // The refresh token never leaves the server
      expect(JSON.stringify(raw.data)).not.toContain("1//")
    })

    it("takes the Google account through its consent screen only, not as typed keys", async () => {
      await callback(await consentPath())
      const typed = await settle(
        http.post(
          "/admin/integrations/credentials/google",
          { settings: { gsc_site: "sc-domain:baska.example.com" }, secrets: {} },
          { headers: admin.headers }
        )
      )
      const removed = await settle(
        http.delete("/admin/integrations/credentials/google", { headers: admin.headers })
      )

      expect([typed.status, removed.status]).toEqual([404, 404])
      expect(await status()).toMatchObject({ connected: true })
    })

    it("names the Merchant Center account only when the Google account reaches it", async () => {
      await connect()
      const wrong = await settle(
        http.post<{ message?: string }>(
          "/admin/google/merchant",
          { merchant_id: "123" },
          { headers: admin.headers }
        )
      )
      const right = await settle(
        http.post(
          "/admin/google/merchant",
          { merchant_id: google.merchantId },
          { headers: admin.headers }
        )
      )

      expect(wrong.status).toBe(400)
      expect(wrong.data.message).toBe("google.merchant_invalid")
      expect(right.status).toBe(200)
      expect((await status()).merchant_id).toBe(google.merchantId)
    })

    it("sends a product once, again when it changes, and removes one no longer sold", async () => {
      await connect()
      await http.post(
        "/admin/google/merchant",
        { merchant_id: google.merchantId },
        { headers: admin.headers }
      )
      const { productId, variantId } = await product(`kupa-${String(Date.now())}`)

      const first = await sync()
      const sent = google.products.get(variantId) as
        { productAttributes: { price: unknown; availability: string } } | undefined
      const afterFirst = google.inserts.count
      const quiet = await sync()
      await getContainer().resolve(Modules.PRODUCT).updateProducts(productId, { title: "Yeni ad" })
      const changed = await sync()
      await getContainer().resolve(Modules.PRODUCT).updateProducts(productId, { status: "draft" })
      const withdrawn = await sync()

      expect(first).toMatchObject({ ran: true, error: null, failed: 0 })
      expect(first.sent).toBeGreaterThanOrEqual(1)
      expect(sent?.productAttributes).toMatchObject({
        price: { amountMicros: "249900000", currencyCode: "TRY" },
        availability: "IN_STOCK",
      })
      expect(google.dataSources).toHaveLength(1)
      // Nothing changed: nothing sent again
      expect(quiet.sent).toBe(0)
      expect(changed.sent).toBe(1)
      expect(google.inserts.count).toBe(afterFirst + 1)
      expect(withdrawn.removed).toBe(1)
      expect(google.products.has(variantId)).toBe(false)
    })

    it("disconnects: Google revokes the access, and nothing is sent any more", async () => {
      await connect()
      await http.delete("/admin/google", { headers: admin.headers })

      expect(google.revoked).toHaveLength(1)
      expect(await status()).toMatchObject({ connected: false, email: null })
      expect(await sync()).toMatchObject({ ran: false })
    })

    it("offers no connection while the platform's Google client is not set up", async () => {
      const id = process.env["GOOGLE_OAUTH_CLIENT_ID"]
      Reflect.deleteProperty(process.env, "GOOGLE_OAUTH_CLIENT_ID")
      try {
        const refused = await settle(
          http.post<{ message?: string }>("/admin/google/connect", {}, { headers: admin.headers })
        )

        expect(refused.data.message).toBe("google.not_configured")
        expect((await status()).configured).toBe(false)
      } finally {
        process.env["GOOGLE_OAUTH_CLIENT_ID"] = id
      }
    })
  },
})
