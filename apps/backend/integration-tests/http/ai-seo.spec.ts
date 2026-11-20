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
import { writePageText } from "../helpers/pages"

jest.setTimeout(120 * 1000)

// What must never reach a service: a person's data in a record, an internal category, a price
const EMAIL = "ayse.yilmaz@example.com"
const PHONE = "0532 123 45 67"
const PERSONAL = `Bilgi için ${EMAIL} ya da ${PHONE}.`
const INTERNAL = "Toptan Gizli Liste"

// Texts that keep to the advisor's length targets (SERP_TEXT_LENGTH)
const TITLE = "Yazlık Keten Gömlek, Rahat ve Nefes Alan Kesim"
const DESCRIPTION =
  "Nefes alan keten kumaştan yazlık gömlek. Rahat kesimi ve doğal dokusuyla her gün giyilebilir; ayrıntılar sayfada."

const unique = () => `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

async function category(container: MedusaContainer, name: string, internal: boolean) {
  const [created] = await container.resolve(Modules.PRODUCT).createProductCategories([
    {
      name,
      handle: `ai-seo-${unique()}`,
      is_active: true,
      is_internal: internal,
      description: `Yazlık ürünlerin listesi. ${PERSONAL}`,
    },
  ])
  return created?.id ?? ""
}

/**
 * docs/22 PR 1-1 (adr/0071 §8–§10, adr/0005): search result titles and
 * descriptions for a product, a category and a content page, on the fake
 * service only. Each record is read on the server by its id; what is sent
 * holds no price, no internal category and no person's data; a text the
 * advisor would flag is refused; "Kullan" writes no field.
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

    async function records3() {
      const container = getContainer()
      const productId = await aiProduct(container)
      const internalId = await category(container, INTERNAL, true)
      await products().updateProducts(productId, {
        description: `Yazlık keten gömlek, nefes alan kumaş. ${PERSONAL}`,
        category_ids: [internalId],
      })
      const categoryId = await category(container, "Yazlık Gömlekler", false)
      const page = await settle(
        http.post<{ entry: { id: string } }>(
          "/admin/content",
          {
            kind: "page",
            title: "Hakkımızda",
            status: "draft",
            excerpt: `Mağazamızın hikâyesi. ${PERSONAL}`,
            author_name: "Ayşe Yılmaz",
          },
          { headers: owner.headers }
        )
      )
      expect(page.status).toBe(201)
      // A page's text is the system's to write (adr/0073 Ek 2026-11-19 (2) K4)
      await writePageText(container, page.data.entry.id, {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Yıllardır üretiyoruz." }] },
        ],
      })
      return { product: productId, category: categoryId, page: page.data.entry.id }
    }

    it("suggests a title and a description for each kind of record, sending only public fields", async () => {
      const ids = await records3()
      const seen = answering((request) =>
        request.system.includes("açıklama yaz") ? DESCRIPTION : TITLE
      )
      const subjects = {
        product: "ürün sayfası",
        category: "kategori sayfası",
        page: "içerik sayfası",
      }

      const answers: { type: string; task: string; status: number; data: AiAnswer }[] = []
      for (const type of ["product", "category", "page"] as const) {
        for (const task of ["seo_title", "seo_description"]) {
          const answer = await ask(owner.headers, { task, entity_type: type, entity_id: ids[type] })
          answers.push({ type, task, ...answer })
        }
      }

      for (const answer of answers) {
        expect([answer.type, answer.task, answer.status]).toEqual([answer.type, answer.task, 201])
        expect(answer.data.suggestion).toMatchObject({
          task: answer.task,
          service: "fake",
          status: "draft",
          text: answer.task === "seo_title" ? TITLE : DESCRIPTION,
        })
      }
      expect(seen).toHaveLength(6)
      for (const [index, request] of seen.entries()) {
        const type = (["product", "category", "page"] as const)[Math.floor(index / 2)] ?? "product"
        expect(request.system).toContain(subjects[type])
        for (const leak of [EMAIL, PHONE, INTERNAL, "Ayşe Yılmaz", "450"]) {
          expect(request.data).not.toContain(leak)
        }
      }
      expect(seen[0]?.data).toContain("Keten Gömlek Yazlık")
      expect(seen[2]?.data).toContain("Yazlık Gömlekler")
      expect(seen[4]?.data).toContain("Hakkımızda")
      const usages = await records().usages()
      expect(usages.map((usage) => usage.entity_id).sort()).toEqual(
        [ids.product, ids.product, ids.category, ids.category, ids.page, ids.page].sort()
      )
    })

    it("writes no field when a suggestion is used", async () => {
      const ids = await records3()
      answering(() => TITLE)

      const asked = await ask(owner.headers, {
        task: "seo_title",
        entity_type: "category",
        entity_id: ids.category,
      })
      const accepted = await settle(
        http.post<AiAnswer>(
          `/admin/ai/suggestions/${asked.data.suggestion?.id ?? ""}/accept`,
          {},
          { headers: owner.headers }
        )
      )

      expect(accepted.data.suggestion).toMatchObject({ status: "accepted", text: TITLE })
      const [stored] = await products().listProductCategories({ id: [ids.category] })
      expect(stored?.name).toBe("Yazlık Gömlekler")
      const [product] = await products().listProducts({ id: [ids.product] })
      expect(product?.title).toBe("Keten Gömlek Yazlık")
    })

    it("refuses a text the advisor would flag and keeps none of it", async () => {
      const productId = await aiProduct(getContainer())
      answering(() => "Kısa başlık")

      const refused = await ask(owner.headers, {
        task: "seo_title",
        entity_type: "product",
        entity_id: productId,
      })

      expect([refused.status, refused.data.message]).toEqual([422, "ai.suggestion_refused"])
      expect(refused.data.problems).toContain("length")
      const [draft] = await records().drafts()
      expect(draft).toMatchObject({ status: "refused", text: "", source: "ai_suggestion" })
    })

    it("answers ai.unknown_entity for a missing, mismatched or internal record, calling nothing", async () => {
      const internalId = await category(getContainer(), INTERNAL, true)
      const productId = await aiProduct(getContainer())
      const seen = answering(() => TITLE)

      const tries = [
        { entity_type: "product", entity_id: "prod_01NOTTHERE0000000000000000" },
        { entity_type: "category", entity_id: productId },
        { entity_type: "category", entity_id: internalId },
        { entity_type: "page", entity_id: "cnt_01NOTTHERE0000000000000000" },
      ]
      const answers = []
      for (const each of tries) {
        answers.push(await ask(owner.headers, { task: "seo_description", ...each }))
      }

      expect(answers.map((answer) => [answer.status, answer.data.message])).toEqual(
        tries.map(() => [400, "ai.unknown_entity"])
      )
      expect(seen).toEqual([])
      expect(await records().usages()).toEqual([])
    })
  },
})
