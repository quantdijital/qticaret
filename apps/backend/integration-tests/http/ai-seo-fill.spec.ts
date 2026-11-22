import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { SEO_ADVISOR_MODULE } from "../../src/modules/seo-advisor"
import type SeoAdvisorModuleService from "../../src/modules/seo-advisor/service"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

// Search texts that keep to the gate (the product's own words, within the length)
const TITLES = [
  "Keten Gömlek Yazlık, Nefes Alan Kumaş ve Rahat Kesim",
  "Yazlık Keten Gömlek: Nefes Alan Kumaştan Rahat Kesim",
]
const DESCRIPTIONS = [
  "Nefes alan keten kumaştan yazlık gömlek. Rahat kesimi ve doğal dokusuyla her gün giyilebilir; ayrıntılar sayfada.",
  "Yazlık keten gömlek, nefes alan kumaşı ve rahat kesimiyle sıcak günlerde serin tutar; bakımı kolay, her güne uyar.",
]

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

interface OpenSuggestion {
  id: string
  task: string
  candidates: string[]
  entity: { type: string; id: string; name: string; current: string | null }
}

const issue = (ruleId: string) => ({ ruleId, severity: "warning", category: "meta", params: {} })

/**
 * adr/0074 §5 madde 7 (G7): the bulk SEO fill on the fake service. The
 * advisor's findings pick the pages; the role and the quota are checked
 * before a job is queued; each suggestion waits for a decision and no
 * page changes until it is accepted, when the page's own SEO save writes
 * it and the decision records the candidate taken.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const records = () => aiRecords(getContainer())
    const advisor = () => getContainer().resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      await connectFake(http, owner.headers, key)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    function answering(): TextRequest[] {
      const seen: TextRequest[] = []
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        const texts = request.system.includes("açıklama yaz") ? DESCRIPTIONS : TITLES
        return Promise.resolve({
          text: texts.join("\n"),
          usage: { inputTokens: 10, outputTokens: 10 },
        })
      })
      return seen
    }

    /** Two products with a missing title and description; every other page found clean. */
    async function pagesWithFindings(): Promise<string[]> {
      const ids = [await aiProduct(getContainer()), await aiProduct(getContainer())]
      for (const id of ids) {
        await eventually(
          () => advisor().listSeoAssessments({ entity_type: "product", entity_id: id }),
          (rows) => rows.length > 0
        )
      }
      // Late assessments of the saves above land first, then the findings are set
      await new Promise((resolve) => setTimeout(resolve, 300))
      const rows = await advisor().listSeoAssessments({})
      for (const row of rows) {
        await advisor().updateSeoAssessments({
          id: row.id,
          // The column is JSON holding the finding list; the model types it as a record
          issues: (ids.includes(row.entity_id)
            ? [issue("P-TITLE-01"), issue("P-META-01")]
            : []) as unknown as Record<string, unknown>,
        })
      }
      return ids
    }

    const seoOf = async (id: string) =>
      (
        await http.get<{ seo: { seo_title: string | null; seo_description: string | null } }>(
          `/admin/seo/product/${id}`,
          { headers: owner.headers }
        )
      ).data.seo

    async function finished(id: string): Promise<Job | undefined> {
      for (let attempt = 0; attempt < 300; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: owner.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return undefined
    }

    it("keeps the fill and its review list the owner's and admin's", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      for (const staff of [operations, readonly]) {
        const statuses = await Promise.all([
          settle(http.get("/admin/ai/seo-fill", { headers: staff.headers })),
          settle(http.post("/admin/ai/seo-fill", {}, { headers: staff.headers })),
          settle(http.get("/admin/ai/seo-fill/suggestions", { headers: staff.headers })),
        ])
        expect(statuses.map((each) => each.status)).toEqual([403, 403, 403])
      }
      expect((await records().drafts()).length).toBe(0)
    })

    it("refuses plainly when the quota left does not cover the job, queuing nothing", async () => {
      await pagesWithFindings()
      // Two pages, a title and a description each: four asks against one credit
      await pushPlan(http, true, { llm_credits_per_month: 1 })
      const seen = answering()

      const count = await http.get<{ pages: number; title: number; description: number }>(
        "/admin/ai/seo-fill",
        { headers: owner.headers }
      )
      expect(count.data).toMatchObject({ pages: 2, title: 2, description: 2, max: 50 })

      const refused = await settle(
        http.post<{ message: string; values?: Record<string, string> }>(
          "/admin/ai/seo-fill",
          {},
          { headers: owner.headers }
        )
      )
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("ai.seo_fill_quota_short")
      expect(refused.data.values).toEqual({ needed: "4", left: "1" })
      expect(seen).toHaveLength(0)
      expect(await records().monthly()).toBe(0)

      // Narrower fits: the title alone is still two asks against one
      const narrower = await settle(
        http.post("/admin/ai/seo-fill", { scope: "title" }, { headers: owner.headers })
      )
      expect(narrower.status).toBe(400)
    })

    it("suggests for each page, writes nothing, and writes the accepted candidate", async () => {
      const [first, second] = await pagesWithFindings()
      answering()

      const queued = await settle(
        http.post<{ job_id: string; pages: number; asks: number }>(
          "/admin/ai/seo-fill",
          {},
          { headers: owner.headers }
        )
      )
      expect(queued.status).toBe(202)
      expect(queued.data).toMatchObject({ pages: 2, asks: 4 })
      const job = await finished(queued.data.job_id)
      expect(job?.status).toBe("succeeded")
      expect(job?.result_summary).toMatchObject({
        pages: 2,
        asked: 4,
        suggested: 4,
        failed: 0,
        stopped: null,
      })

      // Nothing reached a page
      expect(await seoOf(first ?? "")).toMatchObject({ seo_title: null, seo_description: null })
      expect(await seoOf(second ?? "")).toMatchObject({ seo_title: null, seo_description: null })

      const list = await http.get<{ suggestions: OpenSuggestion[] }>(
        "/admin/ai/seo-fill/suggestions",
        { headers: owner.headers }
      )
      expect(list.data.suggestions).toHaveLength(4)
      const title = list.data.suggestions.find(
        (each) => each.entity.id === first && each.task === "seo_title"
      )
      expect(title?.candidates).toEqual(TITLES)
      expect(title?.entity).toMatchObject({ type: "product", current: null })

      // A second run asks nothing again: every task waits for a decision
      const again = await settle(http.post("/admin/ai/seo-fill", {}, { headers: owner.headers }))
      expect(again.status).toBe(400)

      // Accepted: the page's own SEO save, then the decision with the candidate taken
      const saved = await settle(
        http.put(
          `/admin/seo/product/${first ?? ""}`,
          { seo_title: TITLES[1] },
          { headers: owner.headers }
        )
      )
      expect(saved.status).toBe(200)
      const accepted = await settle(
        http.post(
          `/admin/ai/suggestions/${title?.id ?? ""}/accept`,
          { candidate_index: 1 },
          { headers: owner.headers }
        )
      )
      expect(accepted.status).toBe(200)

      expect(await seoOf(first ?? "")).toMatchObject({
        seo_title: TITLES[1],
        seo_description: null,
      })
      expect(await seoOf(second ?? "")).toMatchObject({ seo_title: null, seo_description: null })
      const draft = (await records().drafts()).find((each) => each.id === title?.id)
      expect(draft).toMatchObject({ status: "approved", accepted_index: 1 })
      const left = await http.get<{ suggestions: OpenSuggestion[] }>(
        "/admin/ai/seo-fill/suggestions",
        { headers: owner.headers }
      )
      expect(left.data.suggestions).toHaveLength(3)
    })
  },
})
