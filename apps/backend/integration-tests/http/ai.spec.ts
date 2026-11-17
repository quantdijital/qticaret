import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { aiProviderError } from "../../src/lib/ai/errors"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../src/modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../src/modules/integration-credentials/service"
import { createAdminUser } from "../helpers/admin"
import type { AiAnswer } from "../helpers/ai"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan, storedRunsWith } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { captureOutput } from "../helpers/logs"

jest.setTimeout(120 * 1000)

interface ServicesAnswer {
  services: { id: string; status: string; capabilities: string[] }[]
  tasks: { id: string; usable: string[]; preference: string | null; allowed: boolean }[]
  flags: { own_keys: boolean }
}

/**
 * adr/0071 §4, §5, §8, §11 (PR 0b-3): a text suggestion end to end on the
 * fake service and the test task. Nothing here leaves the machine: only
 * the fake service is ever called; a real service is at most connected in
 * the database to make a choice, and never picked (every ask that could
 * reach it names the fake one).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    // Plainly fake, fresh per run (docs/04)
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const services = async (headers = owner.headers) =>
      (await http.get<ServicesAnswer>("/admin/ai/services", { headers })).data
    const testTask = async (headers = owner.headers) =>
      (await services(headers)).tasks.find((task) => task.id === "test_text")

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
      Reflect.deleteProperty(process.env, "AI_DAILY_LIMIT_TEXT")
    })

    it("answers ai.no_service while nothing is connected, counting nothing", async () => {
      const productId = await aiProduct(getContainer())

      const listed = await services()
      const refused = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
      })

      expect(listed.services.find((each) => each.id === "fake")).toMatchObject({
        status: "not_connected",
        capabilities: ["text", "vision"],
      })
      expect(await testTask()).toMatchObject({ usable: [], preference: null, allowed: true })
      expect([refused.status, refused.data.message]).toEqual([400, "ai.no_service"])
      expect(await records().usages()).toEqual([])
      expect(await records().monthly()).toBe(0)
    })

    it("suggests through the one connected service, records it, and decides it once", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      let asked!: Awaited<ReturnType<typeof ask>>
      let accepted!: { status: number; data: AiAnswer }
      let again!: { status: number; data: AiAnswer }
      let listed!: ServicesAnswer
      const output = await captureOutput(async () => {
        listed = await services()
        asked = await ask(owner.headers, {
          task: "test_text",
          entity_type: "product",
          entity_id: productId,
          option: "plain",
        })
        const id = asked.data.suggestion?.id ?? ""
        accepted = await settle(
          http.post<AiAnswer>(`/admin/ai/suggestions/${id}/accept`, {}, { headers: owner.headers })
        )
        again = await settle(
          http.post<AiAnswer>(`/admin/ai/suggestions/${id}/dismiss`, {}, { headers: owner.headers })
        )
      })

      expect(listed.tasks.find((task) => task.id === "test_text")?.usable).toEqual(["fake"])
      expect(asked.status).toBe(201)
      expect(asked.data.suggestion).toMatchObject({
        task: "test_text",
        service: "fake",
        status: "draft",
        alternatives: [],
      })
      expect(asked.data.suggestion?.text).toContain("Keten Gömlek")
      expect(accepted.data.suggestion).toMatchObject({
        status: "accepted",
        text: asked.data.suggestion?.text,
      })
      expect([again.status, again.data.message]).toEqual([400, "ai.suggestion_not_open"])
      const [usage] = await records().usages()
      expect(usage).toMatchObject({
        task: "test_text",
        capability: "text",
        service: "fake",
        model: "fake-text",
        funding: "own_key",
        status: "succeeded",
        entity_id: productId,
        suggestion_id: asked.data.suggestion?.id,
        requested_by: owner.userId,
      })
      expect(usage?.input_tokens).toBeGreaterThan(0)
      const [draft] = await records().drafts()
      expect(draft).toMatchObject({ provider: "fake", source: "ai_suggestion", status: "approved" })
      expect(await records().monthly()).toBe(1)
      expect(await records().today()).toBe(1)
      // adr/0071 §9: the key is in no answer, no log, no stored run, no prompt
      expect(JSON.stringify([listed, asked.data, accepted.data])).not.toContain(key)
      expect(output).not.toContain(key)
      expect(output).toContain("ai.call")
      expect(await storedRunsWith(getContainer(), key)).toBe(0)
      expect(draft?.prompt).not.toContain(key)
    })

    it("asks for the picked service among two and remembers it; an unknown one is refused", async () => {
      await connectFake(http, owner.headers, key)
      // A real service, connected in the database only: never called here
      const credentials = getContainer().resolve<IntegrationCredentialsModuleService>(
        INTEGRATION_CREDENTIALS_MODULE
      )
      await credentials.store(
        await credentials.draft("deepseek", { settings: {}, secrets: { api_key: key } }),
        "verified",
        null
      )
      const productId = await aiProduct(getContainer())
      const body = { task: "test_text", entity_type: "product", entity_id: productId }

      const before = await testTask()
      const unknown = await ask(owner.headers, { ...body, service: "nope" })
      const picked = await ask(owner.headers, { ...body, service: "fake" })
      const member = await createAdminUser(http, getContainer(), "admin")

      expect(before).toMatchObject({ usable: ["deepseek", "fake"], preference: null })
      expect([unknown.status, unknown.data.message]).toEqual([400, "ai.service_unavailable"])
      expect(picked.status).toBe(201)
      expect(picked.data.suggestion).toMatchObject({ service: "fake", alternatives: ["deepseek"] })
      expect((await testTask())?.preference).toBe("fake")
      // A new member starts with the shop's choice
      expect((await testTask(member.headers))?.preference).toBe("fake")
      expect((await records().usages()).map((usage) => usage.service)).toEqual(["fake"])
    })

    it("gives the quota back and records the failure when the call fails", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      jest
        .spyOn(fakeTextConnector, "complete")
        .mockRejectedValueOnce(
          aiProviderError({ service: "fake", key: "ai.provider_unavailable", code: "http_503" })
        )

      const failed = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
      })

      expect(failed.status).toBe(502)
      expect(failed.data).toMatchObject({ message: "ai.provider_unavailable", provider: "fake" })
      expect(await records().usages()).toEqual([
        expect.objectContaining({ status: "failed", error_code: "http_503", suggestion_id: null }),
      ])
      expect(await records().drafts()).toEqual([])
      expect(await records().monthly()).toBe(0)
      expect(await records().today()).toBe(0)
    })

    it("keeps a refused suggestion's quota and offers no text", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer(), "Gömlek www.ornek-magaza.com")

      const refused = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
      })

      expect(refused.status).toBe(422)
      expect(refused.data).toMatchObject({ message: "ai.suggestion_refused" })
      expect(refused.data.problems).toContain("link")
      expect(JSON.stringify(refused.data)).not.toContain("ornek-magaza")
      expect(await records().usages()).toEqual([expect.objectContaining({ status: "refused" })])
      expect(await records().drafts()).toEqual([
        expect.objectContaining({ status: "refused", text: "" }),
      ])
      // The service did the work: it counts
      expect(await records().monthly()).toBe(1)
    })

    it("stops at the package's monthly operations and at the daily ceiling", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      const body = { task: "test_text", entity_type: "product", entity_id: productId }
      await pushPlan(http, true, { llm_credits_per_month: 1 })

      const first = await ask(owner.headers, body)
      const monthly = await ask(owner.headers, body)

      expect(first.status).toBe(201)
      expect(monthly.status).toBe(403)
      expect(monthly.data).toMatchObject({
        message: "plan.limit_reached",
        limit: "llm_credits_per_month",
      })
      // The refused ask gave its day's claim back
      expect(await records().today()).toBe(1)

      await pushPlan(http, true)
      process.env["AI_DAILY_LIMIT_TEXT"] = "1"
      const daily = await ask(owner.headers, body)
      expect([daily.status, daily.data.message]).toEqual([400, "ai.daily_limit_reached"])
      expect(await records().monthly()).toBe(1)
      expect((await records().usages()).length).toBe(1)
    })

    it("refuses an unknown task, option or product before anything is counted", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())

      const task = await ask(owner.headers, {
        task: "nope",
        entity_type: "product",
        entity_id: productId,
      })
      const option = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
        option: "shout",
      })
      const product = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: "prod_missing1",
      })

      expect([task.status, task.data.message]).toEqual([400, "ai.unknown_task"])
      expect([option.status, option.data.message]).toEqual([400, "ai.unknown_task"])
      expect([product.status, product.data.message]).toEqual([400, "ai.unknown_entity"])
      expect(await records().monthly()).toBe(0)
      expect(await records().today()).toBe(0)
    })
  },
})
