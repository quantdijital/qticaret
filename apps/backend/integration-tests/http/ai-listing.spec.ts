import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// What must never reach a service: a person's data, an internal category, a price
const EMAIL = "ayse.yilmaz@example.com"
const PHONE = "0532 123 45 67"
const PERSONAL = `Bilgi için ${EMAIL} ya da ${PHONE}.`
const INTERNAL = "Toptan Gizli Liste"
const PRODUCT = "Keten Gömlek Yazlık"

const PARAGRAPH =
  "Bu sayfada sıcak günler için seçilmiş hafif ve nefes alan parçalar bir arada duruyor. Gün boyu rahat giyilen modellerden özel günlere uygun seçeneklere kadar farklı ihtiyaçlara göre ürünler bulabilir, kullanım alanınıza göre seçim yapabilirsiniz."
// Over the advisor's listing floor (MIN_LISTING_WORDS), plain paragraphs
const DESCRIPTION = Array.from({ length: 4 }, () => PARAGRAPH).join("\n\n")
const TITLE = "Yazlık Keten Gömlekler, Rahat ve Nefes Alan Kesim"

const unique = () => `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

/**
 * adr/0074 §5 madde 1: a category's, a collection's and a brand's
 * description, and the search texts of a collection and a brand, on the
 * fake service only. Each page is read on the server by its id; what is
 * sent names its products in the storefront's channel and nothing priced,
 * internal or personal; a thin text is refused; "Kullan" writes nothing;
 * a role the task does not allow is turned away.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
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

    async function category(container: MedusaContainer, name: string, internal: boolean) {
      const [created] = await container.resolve(Modules.PRODUCT).createProductCategories([
        {
          name,
          handle: `ai-listing-${unique()}`,
          is_active: true,
          is_internal: internal,
          description: `Yazlık ürünler. ${PERSONAL}`,
        },
      ])
      return created?.id ?? ""
    }

    /** A product in a public and an internal category, a collection and a brand. */
    async function pages() {
      const container = getContainer()
      const productId = await aiProduct(container, PRODUCT)
      const publicId = await category(container, "Yazlık Gömlekler", false)
      const internalId = await category(container, INTERNAL, true)
      const [collection] = await products().createProductCollections([
        { title: "Yaz Seçkisi", handle: `ai-listing-${unique()}` },
      ])
      const collectionId = collection?.id ?? ""
      await products().updateProducts(productId, {
        category_ids: [publicId, internalId],
        collection_id: collectionId,
      })
      const details = await settle(
        http.post(
          `/admin/collections/${collectionId}/details`,
          { description: `Sıcak günlere seçki. ${PERSONAL}` },
          { headers: owner.headers }
        )
      )
      expect(details.status).toBe(200)
      const brand = await settle(
        http.post<{ brand: { id: string } }>(
          "/admin/brands",
          { name: "Örnekmarka", handle: `ai-${unique()}`, description: `Marka. ${PERSONAL}` },
          { headers: owner.headers }
        )
      )
      expect(brand.status).toBe(201)
      const linked = await settle(
        http.post(
          `/admin/products/${productId}/brand`,
          { brand_id: brand.data.brand.id },
          { headers: owner.headers }
        )
      )
      expect(linked.status).toBe(200)
      return {
        product: productId,
        category: publicId,
        internal: internalId,
        collection: collectionId,
        brand: brand.data.brand.id,
      }
    }

    it("writes each listing page's description, sending only public facts", async () => {
      const ids = await pages()
      const seen = answering(() => DESCRIPTION)
      const asks = [
        { task: "category_description", entity_type: "category", entity_id: ids.category },
        { task: "collection_description", entity_type: "collection", entity_id: ids.collection },
        { task: "brand_description", entity_type: "brand", entity_id: ids.brand },
      ]

      const answers = []
      for (const [index, each] of asks.entries()) {
        answers.push(
          await ask(owner.headers, { ...each, option: index === 0 ? "short" : "detailed" })
        )
      }

      expect(answers.map((answer) => answer.status)).toEqual([201, 201, 201])
      for (const answer of answers) {
        expect(answer.data.suggestion).toMatchObject({ service: "fake", text: DESCRIPTION })
      }
      expect(seen.map((request) => request.system)).toEqual([
        expect.stringContaining("kategori sayfasının"),
        expect.stringContaining("koleksiyon sayfasının"),
        expect.stringContaining("marka sayfasının"),
      ])
      for (const request of seen) {
        expect(request.data).toContain(PRODUCT)
        for (const leak of [EMAIL, PHONE, INTERNAL, "450"]) {
          expect(request.data).not.toContain(leak)
        }
      }
      // A collection names its products' brands; a brand its products' shown categories
      expect(seen[1]?.data).toContain("Örnekmarka")
      expect(seen[2]?.data).toContain("Yazlık Gömlekler")
      expect(seen[1]?.data).toContain("Sıcak günlere seçki.")
    })

    it("suggests a search title for a collection and a brand", async () => {
      const ids = await pages()
      const seen = answering(() => TITLE)
      for (const [type, id] of [
        ["collection", ids.collection],
        ["brand", ids.brand],
      ] as const) {
        const answer = await ask(owner.headers, {
          task: "seo_title",
          entity_type: type,
          entity_id: id,
        })
        expect([type, answer.status]).toEqual([type, 201])
      }
      expect(seen[0]?.system).toContain("koleksiyon sayfasına")
      expect(seen[1]?.system).toContain("marka sayfasına")
    })

    it("refuses a thin description, a task on another kind and an internal category, writing nothing", async () => {
      const ids = await pages()
      const seen = answering(() => PARAGRAPH)

      const thin = await ask(owner.headers, {
        task: "brand_description",
        entity_type: "brand",
        entity_id: ids.brand,
      })
      expect([thin.status, thin.data.message]).toEqual([422, "ai.suggestion_refused"])
      expect(thin.data.problems).toContain("too_short")
      const calls = seen.length

      const tries = [
        { task: "brand_description", entity_type: "collection", entity_id: ids.collection },
        { task: "category_description", entity_type: "category", entity_id: ids.internal },
        { task: "collection_description", entity_type: "collection", entity_id: ids.brand },
        { task: "seo_title", entity_type: "brand", entity_id: "brand_01NOTTHERE00000000000000" },
      ]
      for (const each of tries) {
        const answer = await ask(owner.headers, each)
        expect([each.task, answer.status, answer.data.message]).toEqual([
          each.task,
          400,
          "ai.unknown_entity",
        ])
      }
      expect(seen).toHaveLength(calls)
    })

    it("returns the text on Kullan and leaves the page's description as it was", async () => {
      const ids = await pages()
      answering(() => DESCRIPTION)
      const asked = await ask(owner.headers, {
        task: "collection_description",
        entity_type: "collection",
        entity_id: ids.collection,
      })
      const accepted = await settle(
        http.post<{ suggestion?: { status: string; text: string } }>(
          `/admin/ai/suggestions/${asked.data.suggestion?.id ?? ""}/accept`,
          {},
          { headers: owner.headers }
        )
      )
      expect(accepted.data.suggestion).toMatchObject({ status: "accepted", text: DESCRIPTION })
      const board = await settle(
        http.get<{ collection: { description: string | null } }>(
          `/admin/collection-board/${ids.collection}`,
          { headers: owner.headers }
        )
      )
      expect(board.data.collection.description).toContain("Sıcak günlere seçki.")
      expect(board.data.collection.description).not.toContain(PARAGRAPH)
    })

    it("lets only owner and admin ask, and puts the owner's own craft in its place", async () => {
      const ids = await pages()
      const seen = answering(() => DESCRIPTION)
      const body = { task: "brand_description", entity_type: "brand", entity_id: ids.brand }
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      expect((await ask(admin.headers, body)).status).toBe(201)
      expect((await ask(operations.headers, body)).status).toBe(403)
      expect((await ask(readonly.headers, body)).status).toBe(403)

      const saved = await settle(
        http.post(
          "/admin/platform-settings/ai_guidance",
          {
            tasks: {
              brand_description: { extra: "Sıcak bir dil.", craft: "Kendi marka talimatım." },
            },
          },
          { headers: owner.headers }
        )
      )
      expect(saved.status).toBe(200)
      expect((await ask(owner.headers, body)).status).toBe(201)
      const last = seen[seen.length - 1]
      expect(last?.system).toContain("Kendi marka talimatım.")
      expect(last?.system).toContain("Sıcak bir dil.")
      expect(await records().usages()).toHaveLength(2)
    })
  },
})
