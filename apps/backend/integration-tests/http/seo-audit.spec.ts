import { readFileSync, rmSync } from "node:fs"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { DEFAULT_ROBOTS_TXT } from "../../src/modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { SEO_REDIRECTS_MODULE } from "../../src/modules/seo-redirects"
import type SeoRedirectsModuleService from "../../src/modules/seo-redirects/service"
import seoAdvisorNightly from "../../src/jobs/seo-advisor-nightly"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Item {
  reason: string
  subject: string
  count?: number
  target?: string
  entity?: { kind: string; id: string }
}

interface Finding {
  ruleId: string
  severity: string
  count: number
  items: Item[]
}

interface Job {
  id: string
  status: string
  has_result: boolean
  result_summary: { findings: Finding[] } | null
}

const product = (title: string, handle: string, extra: Record<string, unknown> = {}) => ({
  title,
  handle,
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
  ...extra,
})

/** F3.14 (docs/14 §3.9): the store-wide audit job, its findings and its report. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    async function assessed(ids: string[]): Promise<void> {
      for (let attempt = 0; attempt < 50; attempt++) {
        const { data } = await http.get<{ assessments: unknown[] }>(
          `/admin/seo/assessments?kind=product&ids=${ids.join(",")}`,
          { headers: admin.headers }
        )
        if (data.assessments.length === ids.length) {
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("products were not assessed")
    }

    async function runAudit(): Promise<Job> {
      const queued = await post<{ async_job: Job }>("/admin/async-jobs", {
        type: "seo.audit",
        input: {},
      })
      for (let attempt = 0; attempt < 150; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(
          `/admin/async-jobs/${queued.data.async_job.id}`,
          { headers: admin.headers }
        )
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    // The settings cache outlives the database reset between tests: always set back
    afterEach(async () => {
      await settings().saveSection(
        "seo",
        { canonical_host: null, robots_txt: DEFAULT_ROBOTS_TXT },
        null
      )
    })

    afterAll(() => {
      for (const path of filesNamed(/seo-audit-.*\.csv$/)) {
        rmSync(path, { force: true })
      }
    })

    it("finds what holds the shop back in search, with a fix where it knows one", async () => {
      await settings().saveSection(
        "seo",
        { canonical_host: "ornek.test", robots_txt: "User-agent: *\nDisallow: /urun/\n" },
        null
      )
      const category = await post<{ product_category: { id: string } }>(
        "/admin/product-categories",
        { name: "Giyim", is_active: true }
      )
      const first = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Keten Gömlek", "keten-gomlek")
      )
      const second = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Keten Gömlek", "keten-gomlek-mavi", {
          categories: [{ id: category.data.product_category.id }],
        })
      )
      // A draft copy competes with nothing: neither a duplicate nor an orphan
      const draft = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Keten Gömlek", "keten-gomlek-taslak", { status: "draft" })
      )
      // A record renamed ten times keeps ten old paths, each a redirect
      const renamed = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Pamuk Çorap", "pamuk-corap", {
          categories: [{ id: category.data.product_category.id }],
        })
      )
      for (let round = 1; round <= 10; round++) {
        await post(`/admin/products/${renamed.data.product.id}`, {
          handle: `pamuk-corap-${String(round)}`,
        })
      }
      await assessed([first.data.product.id, second.data.product.id, draft.data.product.id])

      const redirects = getContainer().resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
      // Written before chains were flattened on save (an import from elsewhere)
      await redirects.createSeoRedirects([
        { source: "/eski-a", match: "exact", target: "/eski-b", status: 301 },
        { source: "/eski-b", match: "exact", target: "/urun/keten-gomlek", status: 301 },
        { source: "/eski-c", match: "exact", target: "/urun/hic-olmadi", status: 301 },
        // A live page has this path: the rule never runs
        {
          source: "/urun/keten-gomlek-mavi",
          match: "exact",
          target: "/urun/keten-gomlek",
          status: 301,
        },
      ])
      const now = new Date()
      await redirects.createSeoNotFounds([
        { path: "/urun/keten-gomlk", hits: 25, first_seen_at: now, last_seen_at: now },
        // Too few asks to matter
        { path: "/urun/yok", hits: 3, first_seen_at: now, last_seen_at: now },
        // Answered now: a rule took it
        { path: "/eski-a", hits: 40, first_seen_at: now, last_seen_at: now },
      ])

      const job = await runAudit()
      expect(job).toMatchObject({ status: "succeeded", has_result: true })
      const findings = job.result_summary?.findings ?? []
      const byRule = new Map(findings.map((each) => [each.ruleId, each]))
      // Most severe first
      expect(findings[0]?.severity).toBe("critical")

      expect(byRule.get("S-ROBOTS-01")?.items).toEqual([
        { reason: "blocked_all", subject: "/urun/ornek-urun" },
        { reason: "no_sitemap", subject: "Sitemap:" },
      ])
      // The five-minute refresh may build it meanwhile; never built otherwise
      const sitemap = byRule.get("S-SITEMAP-01")
      if (sitemap) {
        expect(sitemap.items).toEqual([{ reason: "never", subject: "sitemap.xml" }])
      }
      expect(byRule.has("S-HOST-01")).toBe(false)

      // The 404 worth a redirect, with the page it most likely meant
      expect(byRule.get("S-404-01")).toMatchObject({ count: 1, severity: "high" })
      expect(byRule.get("S-404-01")?.items).toEqual([
        {
          reason: "missing",
          subject: "/urun/keten-gomlk",
          count: 25,
          target: "/urun/keten-gomlek",
        },
      ])

      // Both live pages show the template's title; their handles tell them apart
      const titles = byRule.get("S-DUP-01")?.items.find((item) => item.reason === "title")
      expect(titles).toMatchObject({
        subject: "Keten Gömlek (keten-gomlek) · Keten Gömlek (keten-gomlek-mavi)",
        count: 2,
      })

      expect(byRule.get("S-ORPHAN-01")).toMatchObject({
        count: 1,
        items: [
          {
            reason: "no_category",
            subject: "Keten Gömlek",
            entity: { kind: "product", id: first.data.product.id },
          },
        ],
      })
      const tidy = byRule.get("S-REDIR-01")?.items ?? []
      expect(tidy).toHaveLength(4)
      expect(tidy).toEqual(
        expect.arrayContaining([
          { reason: "chain", subject: "/eski-a", target: "/eski-b" },
          { reason: "dead_target", subject: "/eski-c", target: "/urun/hic-olmadi" },
          {
            reason: "shadowed",
            subject: "/urun/keten-gomlek-mavi",
            target: "/urun/keten-gomlek",
          },
          {
            reason: "crowded",
            subject: "Pamuk Çorap",
            count: 10,
            entity: { kind: "product", id: renamed.data.product.id },
          },
        ])
      )

      // The report lists the same, one row per item, safe for a spreadsheet
      const result = await http.get<{ url: string }>(`/admin/async-jobs/${job.id}/result`, {
        headers: admin.headers,
      })
      const file = filesNamed(/seo-audit-.*\.csv$/).find((path) =>
        result.data.url.endsWith(path.split("/").pop() ?? "")
      )
      const lines = readFileSync(file ?? "", "utf8")
        .replace(/^\uFEFF/, "")
        .trim()
        .split(/\r?\n/)
      expect(lines[0]).toBe("rule_id;severity;reason;subject;count;target;entity_kind;entity_id")
      expect(lines).toContain("S-404-01;high;missing;/urun/keten-gomlk;25;/urun/keten-gomlek;;")
      expect(lines).toContain(
        `S-ORPHAN-01;high;no_category;Keten Gömlek;;;product;${first.data.product.id}`
      )
    })

    it("runs after the nightly assessments", async () => {
      const { data } = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Seramik Kupa", "seramik-kupa")
      )
      await seoAdvisorNightly(getContainer())
      await assessed([data.product.id])
      const { data: jobs } = await http.get<{ async_jobs: Job[] }>(
        "/admin/async-jobs?type=seo.audit",
        { headers: admin.headers }
      )
      expect(jobs.async_jobs).toHaveLength(1)
    })
  },
})
