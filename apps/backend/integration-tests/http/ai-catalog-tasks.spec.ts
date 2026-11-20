import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { createAdminUser } from "../helpers/admin"
import type { AiAnswer } from "../helpers/ai"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// What must never reach a service: a person's data in a record, an internal category, a price
const EMAIL = "ayse.yilmaz@example.com"
const PHONE = "0532 123 45 67"
const PERSONAL = `Bilgi için ${EMAIL} ya da ${PHONE}.`
const INTERNAL = "Toptan Gizli Liste"

const KEYWORDS = "1. Keten Gömlek\n2. Yazlık Keten Gömlek\n3. Nefes Alan Gömlek"
const KEYWORDS_SHAPED = "keten gömlek\nyazlık keten gömlek\nnefes alan gömlek"
const NAME = "Yazlık Keten Gömlek, Nefes Alan Kumaş"

const unique = () => `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

async function category(container: MedusaContainer, name: string, internal: boolean) {
  const [created] = await container.resolve(Modules.PRODUCT).createProductCategories([
    {
      name,
      handle: `ai-kw-${unique()}`,
      is_active: true,
      is_internal: internal,
      description: `Yazlık gömleklerin listesi. ${PERSONAL}`,
    },
  ])
  return created?.id ?? ""
}

/**
 * docs/22 "Ürün ekranı genişletme 1" (adr/0071 §8–§10): a focus keyword
 * for a product, a category and a content page, and a product name, on
 * the fake service only. Each record is read on the server; what is sent
 * holds no price, no internal category and no person's data; a name with
 * a word the product's facts do not hold is refused; the usage row is
 * written for every call; "Kullan" writes no field.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const products = () => getContainer().resolve(Modules.PRODUCT)

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

    /** The fake service answering with a fixed text, keeping what it was sent. */
    function answering(text: (request: TextRequest) => string): TextRequest[] {
      const seen: TextRequest[] = []
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        return Promise.resolve({
          text: text(request),
          usage: { inputTokens: 10, outputTokens: 10 },
        })
      })
      return seen
    }

    async function product() {
      const container = getContainer()
      const productId = await aiProduct(container)
      const internalId = await category(container, INTERNAL, true)
      await products().updateProducts(productId, {
        description: `Yazlık keten gömlek, nefes alan kumaş. ${PERSONAL}`,
        category_ids: [internalId],
      })
      return productId
    }

    it("suggests focus keywords for each kind of record with an SEO card, sending only public fields", async () => {
      const productId = await product()
      const categoryId = await category(getContainer(), "Yazlık Gömlekler", false)
      const page = await settle(
        http.post<{ entry: { id: string } }>(
          "/admin/content",
          {
            kind: "page",
            title: "Keten Bakım Rehberi",
            status: "draft",
            excerpt: `Keten nasıl yıkanır. ${PERSONAL}`,
            author_name: "Ayşe Yılmaz",
            body: { type: "doc", content: [] },
          },
          { headers: owner.headers }
        )
      )
      expect(page.status).toBe(201)
      const ids = { product: productId, category: categoryId, page: page.data.entry.id }
      const seen = answering(() => KEYWORDS)

      const answers: { status: number; data: AiAnswer }[] = []
      for (const type of ["product", "category", "page"] as const) {
        answers.push(
          await ask(owner.headers, {
            task: "focus_keyword",
            entity_type: type,
            entity_id: ids[type],
          })
        )
      }

      for (const answer of answers) {
        expect(answer.status).toBe(201)
        expect(answer.data.suggestion).toMatchObject({
          task: "focus_keyword",
          service: "fake",
          status: "draft",
          // adr/0074 §4: each keyword a candidate, the main one as the text
          text: KEYWORDS_SHAPED.split("\n")[0],
          candidates: KEYWORDS_SHAPED.split("\n"),
        })
      }
      expect(seen.map((request) => request.system)).toEqual([
        expect.stringContaining("ürün sayfası"),
        expect.stringContaining("kategori sayfası"),
        expect.stringContaining("içerik sayfası"),
      ])
      for (const request of seen) {
        for (const leak of [EMAIL, PHONE, INTERNAL, "Ayşe Yılmaz", "450"]) {
          expect(request.data).not.toContain(leak)
        }
      }
      expect(seen[0]?.data).toContain("Keten Gömlek Yazlık")
      expect(seen[1]?.data).toContain("Yazlık Gömlekler")
      expect(seen[2]?.data).toContain("Keten Bakım Rehberi")
      const usages = await records().usages()
      expect(usages.map((usage) => [usage.task, usage.status, usage.entity_id]).sort()).toEqual(
        Object.values(ids)
          .map((id) => ["focus_keyword", "succeeded", id])
          .sort()
      )
    })

    it("suggests a product name from its facts and writes nothing when it is used", async () => {
      const productId = await product()
      const seen = answering(() => NAME)

      const asked = await ask(owner.headers, {
        task: "product_title",
        entity_type: "product",
        entity_id: productId,
      })
      expect(asked.status).toBe(201)
      expect(asked.data.suggestion).toMatchObject({ task: "product_title", text: NAME })
      const accepted = await settle(
        http.post<AiAnswer>(
          `/admin/ai/suggestions/${asked.data.suggestion?.id ?? ""}/accept`,
          {},
          { headers: owner.headers }
        )
      )

      expect(accepted.data.suggestion).toMatchObject({ status: "accepted", text: NAME })
      const [stored] = await products().listProducts({ id: [productId] })
      expect(stored?.title).toBe("Keten Gömlek Yazlık")
      expect(seen[0]?.system).toContain("ürün adını")
      for (const leak of [EMAIL, PHONE, INTERNAL, "450"]) {
        expect(seen[0]?.data).not.toContain(leak)
      }
    })

    it("refuses a name with an invented feature, keeping the paid call's usage row", async () => {
      const productId = await product()
      answering(() => "Keten Gömlek Yazlık Su Geçirmez Premium")

      const refused = await ask(owner.headers, {
        task: "product_title",
        entity_type: "product",
        entity_id: productId,
      })

      expect([refused.status, refused.data.message]).toEqual([422, "ai.suggestion_refused"])
      expect(refused.data.problems).toContain("ungrounded")
      const [draft] = await records().drafts()
      expect(draft).toMatchObject({ status: "refused", text: "", source: "ai_suggestion" })
      const usages = await records().usages()
      // adr/0074 §4: asked once more with the gate's reasons; both calls are recorded
      expect(usages.map((usage) => [usage.task, usage.status])).toEqual([
        ["product_title", "refused"],
        ["product_title", "refused"],
      ])
    })

    it("asks a name for a product only, and lets no role but owner and admin ask, calling nothing", async () => {
      const categoryId = await category(getContainer(), "Yazlık", false)
      const productId = await aiProduct(getContainer())
      const operations = await createAdminUser(http, getContainer(), "operations")
      const seen = answering(() => NAME)

      const wrongKind = await ask(owner.headers, {
        task: "product_title",
        entity_type: "category",
        entity_id: categoryId,
      })
      const withOption = await ask(owner.headers, {
        task: "focus_keyword",
        option: "short",
        entity_type: "product",
        entity_id: productId,
      })
      const byOperations = await ask(operations.headers, {
        task: "focus_keyword",
        entity_type: "product",
        entity_id: productId,
      })

      expect([wrongKind.status, wrongKind.data.message]).toEqual([400, "ai.unknown_entity"])
      expect([withOption.status, withOption.data.message]).toEqual([400, "ai.unknown_task"])
      expect(byOperations.status).toBe(403)
      expect(seen).toEqual([])
      expect(await records().usages()).toEqual([])
    })
  },
})
