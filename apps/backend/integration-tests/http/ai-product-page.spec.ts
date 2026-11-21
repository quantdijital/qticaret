import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// What must never reach a service: an internal or closed category, a price, a person's data
const EMAIL = "ayse.yilmaz@example.com"
const INTERNAL = "Toptan Gizli Liste"
const CLOSED = "Kapalı Sezon"

const SHORTS = [
  "Yazlık keten gömlek, nefes alan kumaşıyla sıcak günlerde rahat tutar.",
  "Nefes alan keten kumaştan yazlık gömlek. Gün boyu rahat giyilir.",
  "Sıcak günler için hafif keten gömlek.",
]

const unique = () => `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

interface Picks {
  picked: { id: string; name: string }[]
  new_tags: string[]
}

interface Answer {
  suggestion?: { id: string; text: string; candidates: string[]; picks?: Picks | null }
  message?: string
  problems?: string[]
}

/** The code the data block names a record by (`{"label":"e2","value":"keten"}`). */
function codeOf(data: string, name: string): string {
  const block = JSON.parse(data) as { data: Record<string, unknown> }
  for (const value of Object.values(block.data)) {
    if (Array.isArray(value)) {
      const found = (value as { label: string; value: string }[]).find(
        (each) => each.value === name
      )
      if (found) {
        return found.label
      }
    }
  }
  return "missing"
}

/**
 * adr/0074 §5 madde 2: a product's short description, its tags and its
 * categories, on the fake service only. The product is read on the
 * server; the lists name only the shop's own tags and shown categories,
 * never an internal or closed one, a price or a person; a code not in
 * the list is refused; nothing is written or created; only owner and
 * admin ask; the JSON picks take no guidance.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    const key = `test-key-${fakeSecret()}`
    const ask = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Answer>("/admin/ai/suggestions", body, { headers }))
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

    async function category(
      container: MedusaContainer,
      name: string,
      flags: { internal?: boolean; active?: boolean; parent?: string } = {}
    ) {
      const [created] = await container.resolve(Modules.PRODUCT).createProductCategories([
        {
          name,
          handle: `ai-pp-${unique()}`,
          is_active: flags.active ?? true,
          is_internal: flags.internal ?? false,
          ...(flags.parent ? { parent_category_id: flags.parent } : {}),
        },
      ])
      return created?.id ?? ""
    }

    /** A product in one shown category, with one tag; the shop has more of both, some hidden. */
    async function shop() {
      const container = getContainer()
      const product = await aiProduct(container)
      const own = await category(container, "Gömlek")
      const shown = await category(container, "Yazlık Giyim")
      const internal = await category(container, INTERNAL, { internal: true })
      const closed = await category(container, CLOSED, { active: false })
      const underClosed = await category(container, "Kapalının Altı", { parent: closed })
      const tags = await products().createProductTags([
        { value: "pamuklu" },
        { value: "keten" },
        { value: `iletişim ${EMAIL}` },
      ])
      const ids = Object.fromEntries(tags.map((tag) => [tag.value, tag.id]))
      await products().updateProducts(product, {
        category_ids: [own],
        tag_ids: [ids["pamuklu"] ?? ""],
      })
      return { product, own, shown, internal, closed, underClosed, tags: ids }
    }

    it("offers three short descriptions from the product's public facts", async () => {
      const { product } = await shop()
      const seen = answering(() =>
        SHORTS.map((each, index) => `${String(index + 1)}. ${each}`).join("\n")
      )
      const answer = await ask(owner.headers, {
        task: "short_description",
        entity_type: "product",
        entity_id: product,
      })
      expect(answer.status).toBe(201)
      expect(answer.data.suggestion?.candidates).toEqual(SHORTS)
      expect(seen[0]?.system).toContain("kısa açıklama")
      expect(seen[0]?.data).toContain("Keten Gömlek")
      for (const leak of ["450", INTERNAL, CLOSED, "tag_choices", "category_choices"]) {
        expect(seen[0]?.data).not.toContain(leak)
      }
    })

    it("picks the shop's tags by code, new ones apart, creating and writing nothing", async () => {
      const { product, tags } = await shop()
      const before = (await products().listProductTags({})).length
      const seen = answering((request) =>
        JSON.stringify({ existing: [codeOf(request.data, "keten")], new: ["yaz sezonu"] })
      )
      const answer = await ask(owner.headers, {
        task: "product_tags",
        entity_type: "product",
        entity_id: product,
      })
      expect(answer.status).toBe(201)
      expect(answer.data.suggestion?.picks).toEqual({
        picked: [{ id: tags["keten"], name: "keten" }],
        new_tags: ["yaz sezonu"],
      })
      // The list names tags, never ids; the product's own tag is not offered again; no person
      expect(seen[0]?.data).toContain("tag_choices")
      expect(seen[0]?.data).not.toMatch(/ptag_|example\.com/)
      expect(seen[0]?.data).not.toContain('"value":"pamuklu"')
      expect(seen[0]?.system).not.toContain("Mağaza yönergesi")
      expect(await products().listProductTags({})).toHaveLength(before)
      const [stored] = await products().listProducts({ id: product }, { relations: ["tags"] })
      expect(stored?.tags.map((tag) => tag.value)).toEqual(["pamuklu"])
    })

    it("picks only shown categories the product is not in, by code", async () => {
      const { product, shown } = await shop()
      const seen = answering((request) =>
        JSON.stringify({ categories: [codeOf(request.data, "Yazlık Giyim")] })
      )
      const answer = await ask(owner.headers, {
        task: "product_category",
        entity_type: "product",
        entity_id: product,
      })
      expect(answer.status).toBe(201)
      expect(answer.data.suggestion?.picks?.picked).toEqual([{ id: shown, name: "Yazlık Giyim" }])
      const data = seen[0]?.data ?? ""
      expect(data).toContain("category_choices")
      for (const leak of [INTERNAL, CLOSED, "Kapalının Altı", "pcat_", "450"]) {
        expect(data).not.toContain(leak)
      }
      // The product's own category is in its facts, not among the choices
      expect(codeOf(data, "Gömlek")).toBe("missing")
    })

    it("refuses a code the list does not hold, an unknown key and a longer list", async () => {
      const { product, internal } = await shop()
      const answers = [
        JSON.stringify({ categories: ["k99"] }),
        JSON.stringify({ categories: [internal] }),
        JSON.stringify({ categories: ["k1"], reason: "uygun" }),
        JSON.stringify({ categories: ["k1", "k1", "k1", "k1"] }),
      ]
      let turn = 0
      answering(() => answers[turn++] ?? "")
      const problems = []
      for (const sent of answers) {
        expect(sent).not.toBe("")
        const answer = await ask(owner.headers, {
          task: "product_category",
          entity_type: "product",
          entity_id: product,
        })
        expect([answer.status, answer.data.message]).toEqual([422, "ai.suggestion_refused"])
        problems.push(answer.data.problems)
      }
      expect(problems).toEqual([["unknown_code"], ["unknown_code"], ["format"], ["format"]])
      const tags = answering(() => JSON.stringify({ existing: ["e77"], new: [] }))
      const refused = await ask(owner.headers, {
        task: "product_tags",
        entity_type: "product",
        entity_id: product,
      })
      expect([refused.status, refused.data.problems]).toEqual([422, ["unknown_code"]])
      expect(tags).toHaveLength(1)
      // Refused suggestions keep no text
      const drafts = await records().drafts()
      expect(
        drafts.filter((each) => each.status === "refused").every((each) => each.text === "")
      ).toBe(true)
    })

    it("turns away a category ask with nothing left to pick, before any call", async () => {
      const container = getContainer()
      const product = await aiProduct(container)
      const only = await category(container, "Tek Kategori")
      await products().updateProducts(product, { category_ids: [only] })
      const seen = answering(() => JSON.stringify({ categories: [] }))
      const answer = await ask(owner.headers, {
        task: "product_category",
        entity_type: "product",
        entity_id: product,
      })
      expect([answer.status, answer.data.message]).toEqual([400, "ai.no_choices"])
      expect(seen).toHaveLength(0)
      expect(await records().usages()).toHaveLength(0)
    })

    it("lets only owner and admin ask, on a product only, and keeps guidance off the picks", async () => {
      const { product, own } = await shop()
      const seen = answering(() => JSON.stringify({ existing: [], new: ["yaz sezonu"] }))
      const body = { task: "product_tags", entity_type: "product", entity_id: product }
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      expect((await ask(admin.headers, body)).status).toBe(201)
      for (const task of ["product_tags", "product_category", "short_description"]) {
        expect((await ask(operations.headers, { ...body, task })).status).toBe(403)
        expect((await ask(readonly.headers, { ...body, task })).status).toBe(403)
      }
      const other = await ask(owner.headers, { ...body, entity_type: "category", entity_id: own })
      expect([other.status, other.data.message]).toEqual([400, "ai.unknown_entity"])
      expect(seen).toHaveLength(1)

      const saved = await settle(
        http.post(
          "/admin/platform-settings/ai_guidance",
          { tasks: { product_tags: { extra: "Kısa yaz." } } },
          { headers: owner.headers }
        )
      )
      expect(saved.status).toBe(400)
      expect(JSON.stringify(saved.data)).toContain("ai.guidance_unknown_task")
    })
  },
})
