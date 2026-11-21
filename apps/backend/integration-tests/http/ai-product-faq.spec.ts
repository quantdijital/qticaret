import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { PRODUCT_QA_MODULE } from "../../src/modules/product-qa"
import type ProductQaModuleService from "../../src/modules/product-qa/service"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Faq {
  items: { question: string; answer: string }[]
  dropped: number
}

interface Answer {
  suggestion?: { id: string; faq?: Faq | null; question_ids?: string[]; status?: string }
  message?: string
  problems?: string[]
}

interface Listed {
  questions: {
    id: string
    body: string
    author_name: string | null
    by_shop: boolean
    answers: { body: string; by_shop: boolean }[]
  }[]
}

const ASKER = "Ayşe Kaya"
const ASKED = "Merhaba ben Ayşe, kapak sızdırır mı?"

/**
 * adr/0074 §5 madde 4: a product's FAQ drafted on the fake service, from
 * the product's own facts; the published questions go as data, a
 * customer's name masked. "Seçilenleri ekle" sends the kept items, gated
 * again on the server, and adds them as the shop's own questions with
 * their answers: shown on the storefront at once, with no QAPage, no
 * notification and no e-mail. Only owner and admin ask and add.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let storefront: Storefront
    const key = `test-key-${fakeSecret()}`
    const qa = () => getContainer().resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
    const ask = (headers: Record<string, string>, productId: string) =>
      settle(
        http.post<Answer>(
          "/admin/ai/suggestions",
          { task: "product_faq", entity_type: "product", entity_id: productId },
          { headers }
        )
      )
    const add = (headers: Record<string, string>, id: string, items: unknown) =>
      settle(http.post<Answer>(`/admin/ai/suggestions/${id}/faq`, { items }, { headers }))
    const decide = (id: string, decision: "accept" | "dismiss") =>
      settle(
        http.post<Answer>(`/admin/ai/suggestions/${id}/${decision}`, {}, { headers: owner.headers })
      )
    // Customers' words go to the service only with the shop's consent (`ai.reviews`, KVKK)
    const customersOpen = async (enabled: boolean) => {
      const set = await settle(
        http.post("/admin/features/ai.reviews", { enabled }, { headers: owner.headers })
      )
      expect(set.status).toBe(200)
    }
    const notifications = async () =>
      (await getContainer().resolve(Modules.NOTIFICATION).listNotifications({})).length

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      storefront = await createStorefront(getContainer())
      await connectFake(http, owner.headers, key)
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

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

    /** A product with one customer's published question on it. */
    async function product() {
      const id = await aiProduct(getContainer(), "Çelik Termos 750 ml")
      await qa().createProductQuestions({
        product_id: id,
        customer_id: "cus_faq_test",
        author_name: ASKER,
        body: ASKED,
        status: "approved",
      })
      return id
    }

    it("drafts from the product's facts, masks the asker and writes nothing", async () => {
      const id = await product()
      await customersOpen(true)
      const before = await qa().listProductQuestions({ product_id: id })
      const seen = answering(() =>
        JSON.stringify({
          items: [
            { q: "Kaç saat sıcak tutar?", a: "Açıklamaya göre gün boyu sıcak tutar." },
            // Asked already: dropped, as one with a link and one with no question mark
            { q: "Merhaba ben Ayşe, kapak sızdırır mı?", a: "Hayır." },
            { q: "Nereden alınır?", a: "https://ornek.com" },
            { q: "Rengi nedir", a: "Gümüş." },
            { q: "Hacmi ne kadar?", a: "750 ml hacimlidir." },
          ],
        })
      )

      const answer = await ask(owner.headers, id)

      expect(answer.status).toBe(201)
      expect(answer.data.suggestion?.faq).toEqual({
        items: [
          { question: "Kaç saat sıcak tutar?", answer: "Açıklamaya göre gün boyu sıcak tutar." },
          { question: "Hacmi ne kadar?", answer: "750 ml hacimlidir." },
        ],
        dropped: 3,
      })
      const [request] = seen
      expect(request?.json).toBe(true)
      expect(request?.data).toContain("published_questions")
      expect(request?.data).toContain("kapak sızdırır mı?")
      for (const leak of ["Ayşe", "Kaya", "cus_faq_test"]) {
        expect(request?.data).not.toContain(leak)
      }
      expect(await qa().listProductQuestions({ product_id: id })).toHaveLength(before.length)
      // Customers' words are not copied into the suggestion's record
      const draft = (await aiRecords(getContainer()).drafts()).at(-1)
      expect(draft?.prompt).not.toContain("kapak sızdırır")
    })

    it("with AI on customers' words off, sends only the shop's questions yet drops a repeat", async () => {
      const id = await product()
      await qa().createProductQuestions({
        product_id: id,
        author_kind: "shop",
        author_name: "Örnek Mağaza",
        body: "Bulaşık makinesinde yıkanır mı?",
        status: "approved",
      })
      const seen = answering(() =>
        JSON.stringify({
          items: [
            { q: "Kaç saat sıcak tutar?", a: "Açıklamaya göre gün boyu sıcak tutar." },
            // A customer's question, not sent, is still held on the server
            { q: "Merhaba ben Ayşe, kapak sızdırır mı?", a: "Hayır." },
            { q: "Hacmi ne kadar?", a: "750 ml hacimlidir." },
          ],
        })
      )

      const answer = await ask(owner.headers, id)

      expect(answer.status).toBe(201)
      expect(answer.data.suggestion?.faq?.items.map((each) => each.question)).toEqual([
        "Kaç saat sıcak tutar?",
        "Hacmi ne kadar?",
      ])
      const [request] = seen
      expect(request?.data).toContain("published_questions")
      expect(request?.data).toContain("Bulaşık makinesinde yıkanır mı?")
      for (const leak of ["sızdırır", "Ayşe", "Kaya", "cus_faq_test"]) {
        expect(request?.data).not.toContain(leak)
      }
    })

    it("refuses an answer with fewer than two valid items", async () => {
      const id = await product()
      answering(() =>
        JSON.stringify({
          items: [
            { q: "Tek soru mu?", a: "Evet." },
            { q: "Fiyatı?", a: "99 TL" },
          ],
        })
      )
      const answer = await ask(owner.headers, id)
      expect([answer.status, answer.data.message, answer.data.problems]).toEqual([
        422,
        "ai.suggestion_refused",
        ["too_few_valid_items"],
      ])
    })

    it("adds the kept items, edited and gated again, as the shop's questions on the storefront", async () => {
      const id = await product()
      const asked = await ask(owner.headers, id)
      const suggestion = asked.data.suggestion?.id ?? ""
      const sent = await notifications()

      const invalid = await add(owner.headers, suggestion, [
        { q: "Kaç saat sıcak tutar?", a: "Bakınız www.ornek.com" },
      ])
      expect([invalid.status, invalid.data.message]).toEqual([400, "ai.faq_item_invalid"])

      const added = await add(owner.headers, suggestion, [
        { q: "Bu termos ne için kullanılır?", a: "Sıcak ve soğuk içecekleri taşımak içindir." },
        { q: "Hangi seçenekleri var?", a: "Seçenekler ürün sayfasında listelenir." },
      ])
      expect(added.status).toBe(201)
      expect(added.data.suggestion).toMatchObject({ status: "accepted" })
      expect(added.data.suggestion?.question_ids).toHaveLength(2)

      const again = await add(owner.headers, suggestion, [{ q: "Bir daha mı?", a: "Hayır." }])
      expect([again.status, again.data.message]).toEqual([400, "ai.suggestion_not_open"])

      const rows = await qa().listProductQuestions({ product_id: id, author_kind: "shop" })
      expect(rows).toHaveLength(2)
      for (const row of rows) {
        expect(row).toMatchObject({ status: "approved", customer_id: null, answer_count: 1 })
      }
      const listed = await http.get<Listed>(`/store/products/${id}/questions`, {
        headers: storefront.headers,
      })
      const shop = listed.data.questions.filter((each) => each.by_shop)
      expect(shop.map((each) => each.body).sort()).toEqual([
        "Bu termos ne için kullanılır?",
        "Hangi seçenekleri var?",
      ])
      expect(shop[0]?.answers).toEqual([expect.objectContaining({ by_shop: true })])
      const page = await http.get<{ json_ld: unknown; question: { by_shop: boolean } }>(
        `/store/product-questions/${shop[0]?.id ?? ""}`,
        { headers: storefront.headers }
      )
      // Not a question someone asked: no QAPage (docs/13 §5), and FAQPage is never printed
      expect(page.data.question.by_shop).toBe(true)
      expect(page.data.json_ld).toBeNull()
      expect(await notifications()).toBe(sent)

      const draft = (await aiRecords(getContainer()).drafts()).find(
        (each) => each.id === suggestion
      )
      expect(draft).toMatchObject({ status: "approved", accepted_index: 0 })
      const rate = await http.get<{ tasks: { task: string; accepted: number }[] }>(
        "/admin/ai/acceptance",
        { headers: owner.headers }
      )
      expect(rate.data.tasks.find((row) => row.task === "product_faq")).toMatchObject({
        accepted: 1,
      })
    })

    it("takes a draft only by adding items, none of them published already", async () => {
      const id = await product()
      await qa().createProductQuestions({
        product_id: id,
        author_kind: "shop",
        author_name: "Örnek Mağaza",
        body: "Kaç saat sıcak tutar?",
        status: "approved",
      })
      const suggestion = (await ask(owner.headers, id)).data.suggestion?.id ?? ""

      // The generic accept would record a decision with nothing added
      const accepted = await decide(suggestion, "accept")
      expect([accepted.status, accepted.data.message]).toEqual([400, "ai.faq_use_faq_route"])

      const repeat = await add(owner.headers, suggestion, [
        { q: "kaç saat sıcak tutar ?", a: "Gün boyu sıcak tutar." },
      ])
      expect([repeat.status, repeat.data.message]).toEqual([400, "ai.faq_all_published"])

      const mixed = await add(owner.headers, suggestion, [
        { q: "Kaç saat sıcak tutar?", a: "Gün boyu sıcak tutar." },
        { q: "Hacmi ne kadar?", a: "750 ml hacimlidir." },
      ])
      expect(mixed.status).toBe(201)
      expect(mixed.data.suggestion?.question_ids).toHaveLength(1)
      const shop = await qa().listProductQuestions({ product_id: id, author_kind: "shop" })
      expect(shop.map((each) => each.body).sort()).toEqual([
        "Hacmi ne kadar?",
        "Kaç saat sıcak tutar?",
      ])

      // Dismissing a FAQ draft stays open
      const other = (await ask(owner.headers, id)).data.suggestion?.id ?? ""
      expect((await decide(other, "dismiss")).status).toBe(200)
    })

    it("lets only owner and admin ask and add, and gives the FAQ the shop's guidance", async () => {
      const id = await product()
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const saved = await settle(
        http.post(
          "/admin/platform-settings/ai_guidance",
          { tasks: { product_faq: { extra: "Yanıtları kısa tut." } } },
          { headers: owner.headers }
        )
      )
      expect(saved.status).toBe(200)
      const seen = answering(() =>
        JSON.stringify({
          items: [
            { q: "Kaç saat sıcak tutar?", a: "Gün boyu sıcak tutar." },
            { q: "Hacmi ne kadar?", a: "750 ml hacimlidir." },
          ],
        })
      )

      const byAdmin = await ask(admin.headers, id)
      expect(byAdmin.status).toBe(201)
      expect(seen[0]?.system).toContain("Yanıtları kısa tut.")
      expect((await ask(operations.headers, id)).status).toBe(403)
      expect((await ask(readonly.headers, id)).status).toBe(403)

      const items = [{ q: "Kaç saat sıcak tutar?", a: "Gün boyu sıcak tutar." }]
      const suggestion = byAdmin.data.suggestion?.id ?? ""
      expect((await add(operations.headers, suggestion, items)).status).toBe(403)
      expect((await add(readonly.headers, suggestion, items)).status).toBe(403)
      expect(await qa().listProductQuestions({ product_id: id, author_kind: "shop" })).toHaveLength(
        0
      )
      expect((await add(admin.headers, suggestion, items)).status).toBe(201)
    })
  },
})
