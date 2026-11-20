import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { PRODUCT_QA_MODULE } from "../../src/modules/product-qa"
import type ProductQaModuleService from "../../src/modules/product-qa/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { createAdminUser } from "../helpers/admin"
import type { AiAnswer } from "../helpers/ai"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

const DRAFT = "Yorumunuz için teşekkür ederiz; konuyu inceleyip size dönüş yapacağız."
const TITLE = "Yazlık Keten Gömlek, Rahat ve Nefes Alan Kesim"

const unique = () => `${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}`

/**
 * The security review of docs/22 "Aşama 9" (adr/0071 §6, §10): the flag
 * that sends customers' words out is the owner's alone; a decision waits
 * for it as the request did; `operations` decides only its own tasks'
 * suggestions; a body mixing a review task with a picture job's fields is
 * turned away before any service is asked.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer(), "owner")
      await connectFake(http, owner.headers, key)
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) =>
        Promise.resolve({
          text: request.system.includes("arama sonuçlarındaki başlığını") ? TITLE : DRAFT,
          usage: { inputTokens: 10, outputTokens: 10 },
        })
      )
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const setFlag = (headers: Record<string, string>, enabled: boolean) =>
      settle(http.post("/admin/features/ai.reviews", { enabled }, { headers }))

    async function review(productId: string): Promise<string> {
      const [created] = await getContainer()
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .createProductReviews([
          {
            product_id: productId,
            customer_id: `cus_${unique()}`,
            order_id: `order_${unique()}`,
            rating: 4,
            title: null,
            body: "Kumaşı güzel, beden tam oldu",
            author_name: "Deneme K.",
            status: "approved",
          },
        ])
      return created?.id ?? ""
    }

    const decide = (headers: Record<string, string>, id: string, decision: string) =>
      settle(http.post<AiAnswer>(`/admin/ai/suggestions/${id}/${decision}`, {}, { headers }))

    it("keeps the flag the owner's: an admin is refused, the owner switches it", async () => {
      const admin = await createAdminUser(http, getContainer(), "admin")

      const byAdmin = await setFlag(admin.headers, true)
      const byOwner = await setFlag(owner.headers, true)
      const offByAdmin = await setFlag(admin.headers, false)

      expect(byAdmin.status).toBe(403)
      expect(byOwner.status).toBe(200)
      expect(offByAdmin.status).toBe(403)
    })

    it("refuses a summary and an answer while the flag is off", async () => {
      const productId = await aiProduct(getContainer())
      const [question] = await getContainer()
        .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
        .createProductQuestions([
          {
            product_id: productId,
            customer_id: `cus_${unique()}`,
            author_name: "Deneme K.",
            body: "Bu gömlek çeker mi?",
          },
        ])

      const summary = await ask(owner.headers, {
        task: "review_summary",
        entity_type: "product",
        entity_id: productId,
      })
      const answer = await ask(owner.headers, {
        task: "question_answer",
        entity_type: "question",
        entity_id: question?.id ?? "",
      })

      expect([summary.status, summary.data.message]).toEqual([403, "ai.reviews_off"])
      expect([answer.status, answer.data.message]).toEqual([403, "ai.reviews_off"])
      expect(await records().usages()).toEqual([])
    })

    it("refuses a decision on a review task once the flag is off", async () => {
      expect((await setFlag(owner.headers, true)).status).toBe(200)
      const productId = await aiProduct(getContainer())
      const asked = await ask(owner.headers, {
        task: "review_reply",
        entity_type: "review",
        entity_id: await review(productId),
      })
      const id = asked.data.suggestion?.id ?? ""
      expect(asked.status).toBe(201)
      expect((await setFlag(owner.headers, false)).status).toBe(200)

      const accepted = await decide(owner.headers, id, "accept")
      const dismissed = await decide(owner.headers, id, "dismiss")

      expect([accepted.status, accepted.data.message]).toEqual([403, "ai.reviews_off"])
      expect([dismissed.status, dismissed.data.message]).toEqual([403, "ai.reviews_off"])
      const [draft] = await records().drafts()
      expect(draft?.status).toBe("draft")
    })

    it("lets operations decide no suggestion of a task it may not ask for", async () => {
      const productId = await aiProduct(getContainer())
      const operations = await createAdminUser(http, getContainer(), "operations")
      const asked = await ask(owner.headers, {
        task: "seo_title",
        entity_type: "product",
        entity_id: productId,
      })
      const id = asked.data.suggestion?.id ?? ""
      expect(asked.status).toBe(201)

      const accepted = await decide(operations.headers, id, "accept")
      const dismissed = await decide(operations.headers, id, "dismiss")

      expect([accepted.status, accepted.data.message]).toEqual([403, "staff.forbidden"])
      expect([dismissed.status, dismissed.data.message]).toEqual([403, "staff.forbidden"])
      const [draft] = await records().drafts()
      expect(draft?.status).toBe("draft")
    })

    it("turns away a review task mixed with a picture job's fields", async () => {
      expect((await setFlag(owner.headers, true)).status).toBe(200)
      const productId = await aiProduct(getContainer())
      const reviewId = await review(productId)
      const operations = await createAdminUser(http, getContainer(), "operations")
      const media = `media_${unique()}`

      const mixed = []
      for (const body of [
        { task: "review_reply", entity_type: "media", entity_id: media },
        { task: "review_reply", entity_type: "review", entity_id: reviewId, entity_ids: [media] },
        { task: "review_reply", entity_type: "media", entity_ids: [media], option: "white" },
        { task: "review_reply", entity_type: "review", entity_id: reviewId, option: "white" },
      ]) {
        mixed.push((await ask(operations.headers, body)).status)
      }

      expect(mixed).toEqual([400, 400, 400, 400])
      expect(fakeTextConnector.complete).not.toHaveBeenCalled()
      expect(await records().usages()).toEqual([])
    })
  },
})
