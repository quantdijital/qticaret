import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { MIN_PRODUCT_WORDS } from "../../src/lib/seo/advisor"
import { wordCount } from "../../src/lib/seo/advisor/text"
import { createAdminUser } from "../helpers/admin"
import type { AiAnswer } from "../helpers/ai"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// What must never reach a service: a person's data in the description, an internal category, a price
const EMAIL = "ayse.yilmaz@example.com"
const PHONE = "0532 123 45 67"
const INTERNAL = "Toptan Gizli Liste"

const unique = () => `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

async function internalCategory(container: MedusaContainer) {
  const [created] = await container
    .resolve(Modules.PRODUCT)
    .createProductCategories([
      { name: INTERNAL, handle: `ai-desc-${unique()}`, is_active: true, is_internal: true },
    ])
  return created?.id ?? ""
}

/**
 * docs/22 PR 2-1 (adr/0071 §8–§10, adr/0005 KK8): a product's description
 * through the AI core's own routes, on the fake service only. Two
 * ready-made lengths and nothing else; what is sent holds no price, no
 * internal category and no person's data; a text
 * the advisor would flag is refused; "Kullan" writes nothing to the
 * product, and adr/0005's old routes cannot publish a core suggestion.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const products = () => getContainer().resolve(Modules.PRODUCT)
    const descriptionOf = async (id: string) =>
      (await products().listProducts({ id: [id] }))[0]?.description ?? null

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

    /** Spies on the fake service, which still writes its own answer. */
    function watching(): TextRequest[] {
      const seen: TextRequest[] = []
      const complete = fakeTextConnector.complete.bind(fakeTextConnector)
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        return complete(request)
      })
      return seen
    }

    /** A product with someone's data pasted in and an internal category (private attributes: facts.unit.spec.ts). */
    async function product() {
      const container = getContainer()
      const productId = await aiProduct(container, "Keten Gömlek Yazlık")
      await products().updateProducts(productId, {
        description: `Yazlık keten gömlek, nefes alan kumaş. Bilgi için ${EMAIL} ya da ${PHONE}.`,
        category_ids: [await internalCategory(container)],
      })
      return { productId }
    }

    it("writes a description with each ready-made length, sending only public fields", async () => {
      const { productId } = await product()
      const before = await descriptionOf(productId)
      const seen = watching()

      const answers = []
      for (const option of [undefined, "short", "detailed"]) {
        answers.push(
          await ask(owner.headers, {
            task: "product_description",
            entity_type: "product",
            entity_id: productId,
            ...(option ? { option } : {}),
          })
        )
      }

      for (const answer of answers) {
        expect(answer.status).toBe(201)
        expect(answer.data.suggestion).toMatchObject({
          task: "product_description",
          service: "fake",
          status: "draft",
        })
        const text = answer.data.suggestion?.text ?? ""
        expect(wordCount(text)).toBeGreaterThanOrEqual(MIN_PRODUCT_WORDS)
        expect(text).not.toMatch(/<[a-z/]/i)
        expect(text).not.toContain(EMAIL)
      }
      expect(seen).toHaveLength(3)
      expect(seen[1]?.system).toContain("Kısa tut")
      expect(seen[2]?.system).toContain("Ayrıntılı yaz")
      for (const request of seen) {
        expect(request.system).toContain("ürün sayfası")
        expect(request.data).toContain("Keten Gömlek Yazlık")
        for (const leak of [EMAIL, PHONE, INTERNAL, "450"]) {
          expect(request.data).not.toContain(leak)
        }
      }
      // Nothing reached the product
      expect(await descriptionOf(productId)).toBe(before)
      const usages = await records().usages()
      expect(usages.map((usage) => [usage.task, usage.status])).toEqual(
        answers.map(() => ["product_description", "succeeded"])
      )
    })

    it("turns away a length that is not on the list, and any record but a product, calling nothing", async () => {
      const { productId } = await product()
      const [category] = await products().createProductCategories([
        { name: "Yazlık", handle: `ai-desc-${unique()}`, is_active: true },
      ])
      const seen = watching()

      const tries = [
        { option: "long", entity_type: "product", entity_id: productId },
        { option: "plain", entity_type: "product", entity_id: productId },
        { prompt: "Fiyatı da yaz", entity_type: "product", entity_id: productId },
        { entity_type: "category", entity_id: category?.id ?? "" },
      ]
      const answers = []
      for (const each of tries) {
        answers.push(await ask(owner.headers, { task: "product_description", ...each }))
      }

      expect(answers.map((answer) => answer.status)).toEqual([400, 400, 400, 400])
      expect(answers[0]?.data.message).toBe("ai.unknown_task")
      expect(answers[1]?.data.message).toBe("ai.unknown_task")
      expect(answers[3]?.data.message).toBe("ai.unknown_entity")
      expect(seen).toEqual([])
      expect(await records().usages()).toEqual([])
    })

    it("refuses a description the advisor would flag and keeps none of it", async () => {
      const { productId } = await product()
      jest
        .spyOn(fakeTextConnector, "complete")
        .mockResolvedValue({ text: "Kısa bir açıklama.", usage: { outputTokens: 4 } })

      const refused = await ask(owner.headers, {
        task: "product_description",
        entity_type: "product",
        entity_id: productId,
      })

      expect([refused.status, refused.data.message]).toEqual([422, "ai.suggestion_refused"])
      expect(refused.data.problems).toEqual(["too_short"])
      const [draft] = await records().drafts()
      expect(draft).toMatchObject({ status: "refused", text: "", source: "ai_suggestion" })
    })

    it("returns the text on Kullan and writes nothing", async () => {
      const { productId } = await product()
      const before = await descriptionOf(productId)

      const asked = await ask(owner.headers, {
        task: "product_description",
        entity_type: "product",
        entity_id: productId,
        option: "short",
      })
      const id = asked.data.suggestion?.id ?? ""
      const accepted = await settle(
        http.post<AiAnswer>(`/admin/ai/suggestions/${id}/accept`, {}, { headers: owner.headers })
      )

      expect(accepted.status).toBe(200)
      expect(accepted.data.suggestion).toMatchObject({
        status: "accepted",
        text: asked.data.suggestion?.text,
      })
      expect(await descriptionOf(productId)).toBe(before)
    })
  },
})
