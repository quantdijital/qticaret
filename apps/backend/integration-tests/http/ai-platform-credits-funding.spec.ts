import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { forgetProcessCaches } from "../../src/lib/cache/process-caches"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../src/modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../src/modules/integration-credentials/service"
import { AI_PLATFORM_CREDITS } from "../../src/modules/platform-settings/features"
import { SEO_ADVISOR_MODULE } from "../../src/modules/seo-advisor"
import type SeoAdvisorModuleService from "../../src/modules/seo-advisor/service"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { GATED_TITLE, availableStatus, fakeAiGateway } from "../helpers/ai-gateway"
import { listen, managedForThisFile } from "../helpers/control-plane"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

const issue = (ruleId: string) => ({ ruleId, severity: "warning", category: "meta", params: {} })

/**
 * The security review of P4b-1 (O1): a request or a queued job never moves
 * from the shop's own key to the platform's credits, or back, by itself.
 * Asked for the shop's own service while only the platform is usable, the
 * answer is `ai.service_unavailable`; a bulk job keeps the way of paying
 * it was queued with, and stops when only the other way is left.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const gateway = fakeAiGateway()
    const advisor = () => getContainer().resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
    let owner: { headers: Record<string, string> }

    managedForThisFile()

    beforeAll(async () => {
      process.env["CONTROL_PLANE_URL"] = await listen(gateway.server)
    })

    afterAll(() => {
      gateway.server.close()
    })

    beforeEach(async () => {
      forgetProcessCaches()
      resetAiBreakers()
      gateway.calls.length = 0
      gateway.state.answers = []
      gateway.state.status = availableStatus()
      await pushPlan(http, true, {}, { [AI_PLATFORM_CREDITS]: true })
      owner = await createAdminUser(http, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    /** Products with a missing SEO title; every other page found clean (ai-seo-fill.spec.ts). */
    async function pagesWithFindings(count: number): Promise<string[]> {
      const ids: string[] = []
      for (let each = 0; each < count; each++) {
        ids.push(await aiProduct(getContainer()))
      }
      for (const id of ids) {
        await eventually(
          () => advisor().listSeoAssessments({ entity_type: "product", entity_id: id }),
          (rows) => rows.length > 0
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
      for (const row of await advisor().listSeoAssessments({})) {
        await advisor().updateSeoAssessments({
          id: row.id,
          issues: (ids.includes(row.entity_id) ? [issue("P-TITLE-01")] : []) as unknown as Record<
            string,
            unknown
          >,
        })
      }
      return ids
    }

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

    const jobInput = async (id: string) =>
      (await getContainer().resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE).retrieveAsyncJob(id))
        .input as Record<string, unknown>

    it("never spends the platform's credits on a request for the shop's own service", async () => {
      const refused = await ask(owner.headers, {
        task: "seo_title",
        entity_type: "product",
        entity_id: await aiProduct(getContainer()),
        service: "fake",
      })
      expect([refused.status, refused.data.message]).toEqual([400, "ai.service_unavailable"])
      expect(gateway.calls).toHaveLength(0)
    })

    it("stops a fill queued on the shop's key once only the platform is left", async () => {
      await connectFake(http, owner.headers, key)
      await pagesWithFindings(2)
      const credentials = getContainer().resolve<IntegrationCredentialsModuleService>(
        INTEGRATION_CREDENTIALS_MODULE
      )
      // The key is removed while the job runs: after its first page's call
      jest.spyOn(fakeTextConnector, "complete").mockImplementation(async () => {
        await credentials.remove("fake")
        return { text: GATED_TITLE, usage: { inputTokens: 10, outputTokens: 10 } }
      })

      const queued = await settle(
        http.post<{ job_id: string; service: string }>(
          "/admin/ai/seo-fill",
          { scope: "title" },
          { headers: owner.headers }
        )
      )
      expect([queued.status, queued.data.service]).toEqual([202, "fake"])
      expect(await jobInput(queued.data.job_id)).toMatchObject({ funding: "own_key" })
      const job = await finished(queued.data.job_id)

      expect(job?.status).toBe("succeeded")
      expect(job?.result_summary).toMatchObject({
        asked: 1,
        suggested: 1,
        not_asked: 1,
        stopped: "ai.service_unavailable",
      })
      expect(gateway.calls).toHaveLength(0)
    })

    it("queues a fill on the platform's credits past the month's quota, the day's holding", async () => {
      await pagesWithFindings(2)
      // Two asks against one credit a month: the shop's own key would be refused (ai-seo-fill.spec.ts)
      await pushPlan(http, true, { llm_credits_per_month: 1 }, { [AI_PLATFORM_CREDITS]: true })
      const queued = await settle(
        http.post<{ job_id: string; service: string }>(
          "/admin/ai/seo-fill",
          { scope: "title" },
          { headers: owner.headers }
        )
      )
      expect([queued.status, queued.data.service]).toEqual([202, "platform"])
      expect(await jobInput(queued.data.job_id)).toMatchObject({ funding: "platform_credit" })
      const job = await finished(queued.data.job_id)
      expect(job?.result_summary).toMatchObject({ asked: 2, suggested: 2, stopped: null })
      expect(await aiRecords(getContainer()).monthly()).toBe(0)
    })

    it("keeps the bulk alt text job's way of paying the server's, never the request's", async () => {
      await connectFake(http, owner.headers, key)
      const queued = await settle(
        http.post<{ async_job: Job }>(
          "/admin/async-jobs",
          {
            type: "ai.alt_text",
            input: { media_ids: ["media_none1"], funding: "platform_credit" },
          },
          { headers: owner.headers }
        )
      )
      expect(queued.status).toBe(202)
      expect(await jobInput(queued.data.async_job.id)).toMatchObject({ funding: "own_key" })
      await finished(queued.data.async_job.id)
    })
  },
})
