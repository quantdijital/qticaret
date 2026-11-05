import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGoogle } from "@qticaret/testing"
import type { FakeGoogle } from "@qticaret/testing"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { searchPeriods } from "../../src/workflows/seo/insights"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const HOST = "magaza.example.com"
const SITE = `sc-domain:${HOST}`
const CONTENT = "https://www.googleapis.com/auth/content"
const ENV = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_BASE_URL",
  "CRUX_API_KEY",
] as const

interface AuditFinding {
  ruleId: string
  items: { reason: string; subject: string; target?: string }[]
}

interface Insights {
  search_console: boolean
  search: {
    clicks: number
    impressions: number
    prev_clicks: number
    dropped: { path: string; clicks: number; prev_clicks: number }[]
  } | null
  index: { inspected: number; indexed: number }
  vitals: { form_factor: string; has_data: boolean; lcp_ms: number | null; cls: number | null }[]
}

/** F10.11 (docs/13 §10, docs/14 S-GSC-01 and S-CWV-01; KK7): Search Console and CrUX for the shop. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let google: FakeGoogle
    let shop: StockShop
    let admin: { headers: Record<string, string> }

    /** Connects the shop's Google account through the consent screen, allowing `scopes`. */
    const connect = async (scopes?: string[]) => {
      const { data } = await http.post<{ url: string }>(
        "/admin/google/connect",
        {},
        { headers: admin.headers }
      )
      const back = new URL(await google.consent(data.url, "allow", scopes))
      await fetch(`${base()}${back.pathname}${back.search}`, {
        redirect: "manual",
        headers: admin.headers,
      })
    }
    const sites = () =>
      settle(
        http.get<{ sites?: { site_url: string }[]; message?: string }>(
          "/admin/google/search-console/sites",
          { headers: admin.headers }
        )
      )
    const choose = (site: string) =>
      settle(
        http.post<{ message?: string }>(
          "/admin/google/search-console",
          { site },
          { headers: admin.headers }
        )
      )
    /** The store-wide audit, as the panel runs it: a job. */
    const audit = async (): Promise<AuditFinding[]> => {
      const { data: queued } = await http.post<{ async_job: { id: string } }>(
        "/admin/async-jobs",
        { type: "seo.audit", input: {} },
        { headers: admin.headers }
      )
      for (let attempt = 0; attempt < 150; attempt++) {
        const { data } = await http.get<{
          async_job: { status: string; result_summary: { findings: AuditFinding[] } | null }
        }>(`/admin/async-jobs/${queued.async_job.id}`, { headers: admin.headers })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job.result_summary?.findings ?? []
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("audit did not finish")
    }
    const refresh = () =>
      http.post<{ search: { ran: boolean; inspected: number }; field: { ran: boolean } }>(
        "/admin/seo/insights/refresh",
        {},
        { headers: admin.headers }
      )

    beforeAll(async () => {
      google = await startFakeGoogle()
      Object.assign(process.env, {
        GOOGLE_OAUTH_CLIENT_ID: google.client.clientId,
        GOOGLE_OAUTH_CLIENT_SECRET: google.client.clientSecret,
        GOOGLE_BASE_URL: google.url,
        CRUX_API_KEY: google.cruxKey,
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
        .saveSection("seo", { canonical_host: HOST }, null)
    })

    it("names a property the account reads, and refuses one it does not", async () => {
      await connect()
      const listed = await sites()
      const wrong = await choose("sc-domain:baska.example.com")
      const right = await choose(SITE)
      const status = await http.get<{ google: { search_console: unknown } }>("/admin/google", {
        headers: admin.headers,
      })

      expect(listed.data.sites).toEqual([{ site_url: SITE, permission: "siteOwner" }])
      expect(wrong.data.message).toBe("google.gsc_site_invalid")
      expect(right.status).toBe(200)
      expect(status.data.google.search_console).toEqual({ granted: true, site: SITE })
    })

    it("submits the sitemap, keeps the pages' figures, inspects pages, and reads CrUX", async () => {
      const handle = `kupa-${String(Date.now())}`
      await stockedProduct(getContainer(), shop, handle, 5, 120)
      const page = `https://${HOST}/urun/${handle}`
      const periods = searchPeriods(new Date())
      google.searchRows = ({ startDate }) =>
        startDate === periods.current.startDate
          ? [{ keys: [page], clicks: 3, impressions: 900, ctr: 3 / 900, position: 8.4 }]
          : [{ keys: [page], clicks: 50, impressions: 1000, ctr: 0.05, position: 6.1 }]
      google.inspections.set(page, {
        verdict: "NEUTRAL",
        coverageState: "Discovered - currently not indexed",
      })
      google.crux.set("PHONE", { lcp: 3200, inp: 150, cls: "0.05" })
      await connect()
      await choose(SITE)

      const ran = await refresh()
      const { data } = await http.get<{ insights: Insights }>("/admin/seo/insights", {
        headers: admin.headers,
      })
      const findings = await audit()
      const gsc = findings.find((each) => each.ruleId === "S-GSC-01")
      const cwv = findings.find((each) => each.ruleId === "S-CWV-01")

      expect(ran.data).toMatchObject({ search: { ran: true }, field: { ran: true } })
      // The platform's Google client is set: the panel shows the Search Console part
      expect(data.insights.search_console).toBe(true)
      expect(google.sitemaps).toEqual([`${SITE} https://${HOST}/sitemap.xml`])
      expect(google.inspected).toContain(page)
      expect(data.insights.search).toMatchObject({
        clicks: 3,
        impressions: 900,
        prev_clicks: 50,
        dropped: [{ path: `/urun/${handle}`, clicks: 3, prev_clicks: 50 }],
      })
      expect(data.insights.index.indexed).toBeLessThan(data.insights.index.inspected)
      expect(data.insights.vitals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            form_factor: "PHONE",
            has_data: true,
            lcp_ms: 3200,
            cls: 0.05,
          }),
          expect.objectContaining({ form_factor: "DESKTOP", has_data: false }),
        ])
      )
      // KK7: what Search Console found shows in the advisor
      expect(gsc?.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason: "not_indexed", subject: `/urun/${handle}` }),
          expect.objectContaining({ reason: "clicks_dropped", subject: `/urun/${handle}` }),
          expect.objectContaining({ reason: "low_ctr", subject: `/urun/${handle}` }),
        ])
      )
      expect(cwv?.items).toEqual([{ reason: "lcp", subject: "PHONE", target: "3200" }])
    })

    it("asks to connect again when the account was connected without Search Console", async () => {
      await connect([CONTENT, "openid", "email"])
      const listed = await sites()
      const ran = await refresh()

      expect(listed.data.message).toBe("google.search_console_scope")
      expect(ran.data.search.ran).toBe(false)
    })
  },
})
