import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { PRODUCT_QA_MODULE } from "../../src/modules/product-qa"
import type ProductQaModuleService from "../../src/modules/product-qa/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { createAdminUser } from "../helpers/admin"
import type { AiAnswer } from "../helpers/ai"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan, storedRunsWith } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// What must never reach a service: who wrote it and how to reach them
const AUTHOR = "Gülşen T."
const EMAIL = "gulsen.test@example.com"
const PHONE = "0532 765 43 21"
const PENDING = "Bu yorum henüz onay bekliyor"

const unique = () => `${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}`

/**
 * docs/22 "Aşama 9" (adr/0071 §6, §10): a product's reviews summed up, a
 * reply and an answer drafted, on the fake service only. The shop's own
 * flag (`ai.reviews`), off by default, holds every one of them; what is
 * sent has the words and the rating, never the author's name, contact,
 * customer or order; a draft fills a form and is never sent by itself;
 * `operations` may ask for these tasks and no other.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const reviews = () =>
      getContainer().resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    const questions = () => getContainer().resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)

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

    function watching(): TextRequest[] {
      const seen: TextRequest[] = []
      const complete = fakeTextConnector.complete.bind(fakeTextConnector)
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        return complete(request)
      })
      return seen
    }

    const setFlag = async (enabled: boolean) => {
      const set = await settle(
        http.post("/admin/features/ai.reviews", { enabled }, { headers: owner.headers })
      )
      expect(set.status).toBe(200)
    }

    async function review(
      productId: string,
      body: string,
      status: "approved" | "pending" = "approved"
    ) {
      const [created] = await reviews().createProductReviews([
        {
          product_id: productId,
          customer_id: `cus_${unique()}`,
          order_id: `order_${unique()}`,
          rating: 2,
          title: "Hayal kırıklığı",
          body,
          author_name: AUTHOR,
          status,
        },
      ])
      return created?.id ?? ""
    }

    const reviewText = `Ben Gülşen, dikiş ilk yıkamada söküldü. Bana ${EMAIL} ya da ${PHONE} ile ulaşın.`

    it("refuses every review task while the shop's flag is off, and hides them", async () => {
      const productId = await aiProduct(getContainer())
      const reviewId = await review(productId, reviewText)
      const seen = watching()

      const refused = await ask(owner.headers, {
        task: "review_reply",
        entity_type: "review",
        entity_id: reviewId,
      })
      const listed = await settle(
        http.get<{ tasks: { id: string; allowed: boolean }[] }>("/admin/ai/services", {
          headers: owner.headers,
        })
      )

      expect([refused.status, refused.data.message]).toEqual([403, "ai.reviews_off"])
      const allowed = Object.fromEntries(listed.data.tasks.map((each) => [each.id, each.allowed]))
      expect(allowed).toMatchObject({
        review_summary: false,
        review_reply: false,
        question_answer: false,
        seo_title: true,
      })
      expect(seen).toEqual([])
      expect(await records().usages()).toEqual([])
    })

    it("drafts a reply from the words and the rating only, and sends none of it", async () => {
      await setFlag(true)
      const productId = await aiProduct(getContainer())
      const reviewId = await review(productId, reviewText)
      const seen = watching()

      const asked = await ask(owner.headers, {
        task: "review_reply",
        entity_type: "review",
        entity_id: reviewId,
      })
      const accepted = await settle(
        http.post<AiAnswer>(
          `/admin/ai/suggestions/${asked.data.suggestion?.id ?? ""}/accept`,
          {},
          { headers: owner.headers }
        )
      )

      expect(asked.status).toBe(201)
      expect(accepted.status).toBe(200)
      expect(seen).toHaveLength(1)
      const data = seen[0]?.data ?? ""
      expect(data).toContain("2/5")
      expect(data).toContain("dikiş ilk yıkamada söküldü")
      for (const leak of ["Gülşen", EMAIL, PHONE, "cus_", "order_"]) {
        expect(data).not.toContain(leak)
      }
      // The draft is not the reply: the review is as it was
      const [after] = await reviews().listProductReviews({ id: reviewId })
      expect(after?.reply).toBeNull()
      // Customers' words are not copied into the suggestion, nor into a stored run
      const [draft] = await records().drafts()
      expect(draft?.prompt).not.toContain("söküldü")
      expect(await storedRunsWith(getContainer(), "söküldü")).toBe(0)
    })

    it("sums up approved reviews only, and wants a few of them", async () => {
      await setFlag(true)
      const productId = await aiProduct(getContainer())
      await review(productId, "Kumaş çok güzel")
      await review(productId, "Beden tam oldu")
      const tooFew = await ask(owner.headers, {
        task: "review_summary",
        entity_type: "product",
        entity_id: productId,
      })
      await review(productId, reviewText)
      await review(productId, PENDING, "pending")
      const seen = watching()

      const summed = await ask(owner.headers, {
        task: "review_summary",
        entity_type: "product",
        entity_id: productId,
      })

      expect([tooFew.status, tooFew.data.message]).toEqual([400, "ai.not_enough_reviews"])
      expect(summed.status).toBe(201)
      const data = seen[0]?.data ?? ""
      expect(data).toContain("Kumaş çok güzel")
      for (const leak of [PENDING, "Gülşen", EMAIL, PHONE]) {
        expect(data).not.toContain(leak)
      }
    })

    it("drafts an answer to a question without its author's name", async () => {
      await setFlag(true)
      const productId = await aiProduct(getContainer())
      const [question] = await questions().createProductQuestions([
        {
          product_id: productId,
          customer_id: `cus_${unique()}`,
          author_name: AUTHOR,
          body: `Merhaba ben Gülşen, bu gömlek çeker mi? ${EMAIL}`,
        },
      ])
      const seen = watching()

      const asked = await ask(owner.headers, {
        task: "question_answer",
        entity_type: "question",
        entity_id: question?.id ?? "",
      })

      expect(asked.status).toBe(201)
      const data = seen[0]?.data ?? ""
      expect(data).toContain("çeker mi")
      expect(data).toContain("Keten Gömlek")
      for (const leak of ["Gülşen", EMAIL]) {
        expect(data).not.toContain(leak)
      }
    })

    it("opens these tasks to operations and no other; read-only staff none", async () => {
      await setFlag(true)
      const productId = await aiProduct(getContainer())
      const reviewId = await review(productId, reviewText)
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      const reply = await ask(operations.headers, {
        task: "review_reply",
        entity_type: "review",
        entity_id: reviewId,
      })
      const decided = await settle(
        http.post<AiAnswer>(
          `/admin/ai/suggestions/${reply.data.suggestion?.id ?? ""}/dismiss`,
          {},
          { headers: operations.headers }
        )
      )
      const others = []
      for (const task of ["seo_title", "seo_description", "product_description"]) {
        others.push(
          await ask(operations.headers, { task, entity_type: "product", entity_id: productId })
        )
      }
      const byReadonly = await ask(readonly.headers, {
        task: "review_reply",
        entity_type: "review",
        entity_id: reviewId,
      })

      expect(reply.status).toBe(201)
      expect(decided.status).toBe(200)
      expect(others.map((each) => each.status)).toEqual([403, 403, 403])
      expect(byReadonly.status).toBe(403)
      // Only the one allowed ask was made
      expect((await records().usages()).map((usage) => usage.task)).toEqual(["review_reply"])
    })
  },
})
