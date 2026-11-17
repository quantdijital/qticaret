import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { aiProviderError } from "../../src/lib/ai/errors"
import { AI_MODULE } from "../../src/modules/ai"
import type AiModuleService from "../../src/modules/ai/service"
import ContentDraftsModuleService from "../../src/modules/content-drafts/service"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

/**
 * The security review of PR 170 (adr/0071): an AI suggestion stays off the
 * adr/0005 draft routes (O1), a removed member is forgotten (O2), the
 * quota is kept when the service may have done the work (D3), and a
 * failure after the day's claim gives the day back (D4). Only the fake
 * service is ever called.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const ai = () => getContainer().resolve<AiModuleService>(AI_MODULE)
    const page = async (productId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: ["description", "seo_meta.seo_title"],
          filters: { id: productId },
        })
      return data[0] as { description: string | null; seo_meta?: { seo_title?: string | null } }
    }

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("keeps an AI suggestion off the adr/0005 draft routes (O1)", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      const before = await page(productId)

      const asked = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
      })
      const [draft] = await records().drafts()
      const approved = await settle(
        http.post<{ message?: string }>(
          `/admin/content-drafts/${draft?.id ?? ""}/approve`,
          {},
          { headers: owner.headers }
        )
      )
      const listed = await http.get<{ drafts: { id: string }[] }>(
        `/admin/content-drafts?entity_type=product&entity_id=${productId}`,
        { headers: owner.headers }
      )

      expect(asked.status).toBe(201)
      expect(draft).toMatchObject({ source: "ai_suggestion", status: "draft" })
      expect([approved.status, approved.data.message]).toEqual([400, "content_drafts.not_open"])
      expect(await page(productId)).toEqual(before)
      expect(listed.data.drafts).toEqual([])
      expect((await records().drafts())[0]?.status).toBe("draft")
    })

    it("forgets a removed member's choices and name on the usage report (O2)", async () => {
      const leaver = await createAdminUser(http, getContainer(), "admin")
      await ai().rememberChoice({ user_id: leaver.userId, task: "test_text", service: "fake" })
      await ai().recordUsage({
        task: "test_text",
        capability: "text",
        service: "fake",
        model: "fake-text",
        funding: "own_key",
        status: "succeeded",
        input_tokens: 10,
        output_tokens: 5,
        estimated_cost_micros: 1,
        currency: "USD",
        entity_type: "product",
        entity_id: "prod_1",
        duration_ms: 3,
        requested_by: leaver.userId,
      })

      const removed = await settle(
        http.delete(`/admin/staff/members/${leaver.userId}`, { headers: owner.headers })
      )

      expect(removed.status).toBe(200)
      expect(await ai().listAiPreferences({ user_id: leaver.userId })).toEqual([])
      expect(await records().usages()).toEqual([
        expect.objectContaining({ status: "succeeded", requested_by: null }),
      ])
    })

    it("keeps the quota after a timeout: the service may have done the work (D3)", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      jest
        .spyOn(fakeTextConnector, "complete")
        .mockRejectedValueOnce(
          aiProviderError({ service: "fake", key: "ai.timeout", code: "timeout" })
        )

      const failed = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
      })

      expect(failed.status).toBe(502)
      expect(failed.data).toMatchObject({ message: "ai.timeout", provider: "fake" })
      expect(await records().usages()).toEqual([
        expect.objectContaining({ status: "timeout", error_code: "timeout" }),
      ])
      expect(await records().monthly()).toBe(1)
      expect(await records().today()).toBe(1)
    })

    it("gives the day's claim back when the month's claim fails (D4)", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      jest
        .spyOn(ContentDraftsModuleService.prototype, "claimQuota")
        .mockRejectedValueOnce(new Error("draft_usage unreachable"))
      const complete = jest.spyOn(fakeTextConnector, "complete")

      const failed = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
      })

      expect(failed.status).toBe(500)
      expect(complete).not.toHaveBeenCalled()
      expect(await records().usages()).toEqual([])
      expect(await records().monthly()).toBe(0)
      expect(await records().today()).toBe(0)
    })
  },
})
