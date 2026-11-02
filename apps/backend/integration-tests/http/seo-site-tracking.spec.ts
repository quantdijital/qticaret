import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeConversions } from "@qticaret/testing"
import type { FakeConversions } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Site {
  tracking: { ga4_measurement_id: string | null; meta_pixel_id: string | null }
}

const TEST_EVENT_CODE = "TEST42917"

/** F18 (adr/0038 §4): the storefront's browser tags take their public ids from the connected accounts. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeConversions

    beforeAll(async () => {
      fake = await startFakeConversions()
      Object.assign(process.env, { META_GRAPH_BASE_URL: fake.url, GA4_BASE_URL: fake.url })
    })

    afterAll(async () => {
      for (const name of ["META_GRAPH_BASE_URL", "GA4_BASE_URL"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    it("serves the GA4 and Meta ids once connected, and no secret of either account", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const site = () => settle(http.get<Site>("/store/seo/site", { headers: store.headers }))
      const connect = (provider: "meta" | "ga4", body: Record<string, unknown>) =>
        settle(
          http.post(`/admin/integrations/credentials/${provider}`, body, {
            headers: admin.headers,
          })
        )
      const disconnect = (provider: "meta" | "ga4") =>
        settle(
          http.delete(`/admin/integrations/credentials/${provider}`, { headers: admin.headers })
        )

      const before = await site()
      const ga4 = await connect("ga4", {
        settings: { measurement_id: fake.ga4.measurementId },
        secrets: { api_secret: fake.ga4.apiSecret },
      })
      const meta = await connect("meta", {
        settings: { pixel_id: fake.meta.pixelId, test_event_code: TEST_EVENT_CODE },
        secrets: { access_token: fake.meta.accessToken },
      })
      const after = await site()

      expect(before.status).toBe(200)
      expect(before.data.tracking).toEqual({ ga4_measurement_id: null, meta_pixel_id: null })
      expect(ga4.status).toBe(200)
      expect(meta.status).toBe(200)
      expect(after.status).toBe(200)
      expect(after.data.tracking).toEqual({
        ga4_measurement_id: fake.ga4.measurementId,
        meta_pixel_id: fake.meta.pixelId,
      })
      // The two ids are the only things of the accounts in the answer
      const body = JSON.stringify(after.data)
      for (const kept of [fake.ga4.apiSecret, fake.meta.accessToken, TEST_EVENT_CODE]) {
        expect(body).not.toContain(kept)
      }
      for (const key of ["api_secret", "access_token", "test_event_code", "secret_ciphertext"]) {
        expect(body).not.toContain(key)
      }

      expect((await disconnect("ga4")).status).toBe(200)
      const gone = await site()
      expect(gone.data.tracking).toEqual({
        ga4_measurement_id: null,
        meta_pixel_id: fake.meta.pixelId,
      })
    })
  },
})
