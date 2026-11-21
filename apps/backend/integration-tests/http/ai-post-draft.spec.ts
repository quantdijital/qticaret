import { createProductsWorkflow, createSalesChannelsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { createAdminUser } from "../helpers/admin"
import { aiRecords, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface DraftLink {
  code: string
  kind: string
  id: string
  name: string
  path: string
  why: string
}

interface Answer {
  suggestion?: {
    id: string
    task: string
    status: string
    text: string | null
    draft?: {
      sections: { heading: string; level: number; paragraphs: string[] }[]
      links: DraftLink[]
      words: number
      dropped_links: number
    } | null
  }
  message?: string
  problems?: string[]
}

const AUTHOR = "Ayşe Yılmaz"
const BODY_MARK = "Gövdedeki eski cümle yalnız burada durur."
const SHOWN = "Keten Gömlek Bakım Ürünleri"
const INTERNAL = "Toptan Gizli Liste"
const CLOSED = "Kapalı Raf Gömlekleri"
const SHOWN_PRODUCT = "Keten Gömlek Vitrin Ürünü"
const DRAFT_PRODUCT = "Keten Gömlek Taslak Ürünü"
const OTHER_CHANNEL_PRODUCT = "Keten Gömlek Toptan Kanal Ürünü"

// Texts that keep to the advisor's length targets (SERP_TEXT_LENGTH)
const TITLE = "Keten Gömlek Nasıl Yıkanır? Adım Adım Bakım Rehberi"
const DESCRIPTION =
  "Keten gömleği çekmeden ve solmadan yıkamanın yolları: su sıcaklığı, kurutma ve ütü. Adım adım bakım önerileri bu yazıda."
const KEYWORDS = "1. Keten Gömlek Yıkama\n2. Keten Bakımı\n3. Keten Gömlek Ütüleme"

const unique = () => `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

/** The data block's link candidates: code and the text sent with it. */
function choicesOf(request: TextRequest | undefined): { label: string; value: string }[] {
  const block = JSON.parse(request?.data ?? "{}") as {
    data?: { link_choices?: { label: string; value: string }[] }
  }
  return block.data?.link_choices ?? []
}

/**
 * adr/0074 §5 madde 5 (G5): a blog post's draft on the fake service, from
 * its title, focus keyword and summary alone (no body, no author); the
 * sections pass the shared gate or the whole draft is refused, while a
 * link naming a code the server did not list drops alone. A post also
 * takes the search texts (title, description, focus keyword). Only owner
 * and admin ask; a page's id is not a post's.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    const key = `test-key-${fakeSecret()}`
    const ask = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Answer>("/admin/ai/suggestions", body, { headers }))
    const draftOf = (headers: Record<string, string>, postId: string) =>
      ask(headers, { task: "post_draft", entity_type: "post", entity_id: postId })

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

    /** The fake's own draft, changed by `edit`; what was sent is kept. */
    function answering(
      edit: (draft: Record<string, unknown>) => unknown = (d) => d
    ): TextRequest[] {
      const original = fakeTextConnector.complete.bind(fakeTextConnector)
      const seen: TextRequest[] = []
      jest.spyOn(fakeTextConnector, "complete").mockImplementation(async (request) => {
        seen.push(request)
        const answer = await original(request)
        const draft = JSON.parse(answer.text) as Record<string, unknown>
        return { ...answer, text: JSON.stringify(edit(draft)) }
      })
      return seen
    }

    /** A plain answer for the one-text tasks. */
    function answeringText(text: (request: TextRequest) => string): TextRequest[] {
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

    async function content(kind: "post" | "page", title: string): Promise<string> {
      const created = await settle(
        http.post<{ entry: { id: string } }>(
          "/admin/content",
          {
            kind,
            title,
            status: "draft",
            excerpt: "Keten gömleği çekmeden yıkamanın yolları.",
            author_name: AUTHOR,
            ...(kind === "post"
              ? {
                  body: {
                    type: "doc",
                    content: [{ type: "paragraph", content: [{ type: "text", text: BODY_MARK }] }],
                  },
                }
              : {}),
          },
          { headers: owner.headers }
        )
      )
      expect(created.status).toBe(201)
      return created.data.entry.id
    }

    async function category(name: string, extra: Record<string, unknown>): Promise<string> {
      const created = await settle(
        http.post<{ product_category: { id: string } }>(
          "/admin/product-categories",
          { name, handle: `ai-post-${unique()}`, is_active: true, ...extra },
          { headers: owner.headers }
        )
      )
      expect(created.status).toBe(200)
      return created.data.product_category.id
    }

    it("drafts from the title, keyword and summary, keeping only links the server listed", async () => {
      const shownId = await category(SHOWN, {})
      await category(INTERNAL, { is_internal: true })
      await category(CLOSED, { is_active: false })
      const postId = await content("post", "Keten Gömlek Nasıl Yıkanır")
      const keyword = await settle(
        http.put(
          `/admin/seo/post/${postId}`,
          { focus_keyword: "keten gömlek yıkama" },
          { headers: owner.headers }
        )
      )
      expect(keyword.status).toBe(200)
      let shownCode = ""
      const seen = answering((draft) => {
        shownCode = choicesOf(seen[0]).find((each) => each.value.includes(SHOWN))?.label ?? ""
        return {
          ...draft,
          links: [
            { code: shownCode, why: "Bakım bölümünde okurun aradığı ürünler burada." },
            // Not listed, and listed twice: each dropped alone
            { code: "k99", why: "Uydurma bir sayfa." },
            { code: shownCode, why: "Aynı sayfa bir daha." },
          ],
        }
      })

      const answer = await draftOf(owner.headers, postId)

      expect(answer.status).toBe(201)
      const draft = answer.data.suggestion?.draft
      expect(draft?.sections.length).toBeGreaterThanOrEqual(3)
      expect(draft?.sections[0]?.heading).toBe("")
      expect(draft?.links).toEqual([
        expect.objectContaining({
          code: shownCode,
          kind: "category",
          id: shownId,
          name: SHOWN,
          path: expect.stringMatching(/^\//) as unknown,
        }),
      ])
      expect(draft?.dropped_links).toBe(2)
      const [request] = seen
      expect(request?.json).toBe(true)
      expect(request?.data).toContain("Keten Gömlek Nasıl Yıkanır")
      expect(request?.data).toContain("keten gömlek yıkama")
      expect(request?.data).toContain("çekmeden yıkamanın")
      for (const leak of [AUTHOR, BODY_MARK, INTERNAL, CLOSED, shownId]) {
        expect(request?.data).not.toContain(leak)
      }
    })

    /** A product with a path of its own (the create hook claims one, whatever its status). */
    async function product(title: string, status: "draft" | "published", channelId: string) {
      await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title,
              handle: `ai-post-${unique()}`,
              status,
              options: [{ title: "Seçenek", values: ["Standart"] }],
              variants: [
                {
                  title: "Standart",
                  options: { Seçenek: "Standart" },
                  manage_inventory: false,
                  prices: [{ currency_code: "try", amount: 100 }],
                },
              ],
              sales_channels: [{ id: channelId }],
            },
          ],
        },
      })
    }

    it("names no draft product and none outside the storefront's channels", async () => {
      const storefront = await createStorefront(getContainer())
      const { result: channels } = await createSalesChannelsWorkflow(getContainer()).run({
        input: { salesChannelsData: [{ name: `Toptan kanal ${unique()}` }] },
      })
      const otherChannel = channels[0]?.id ?? ""
      expect(otherChannel).not.toBe("")
      // Names near the post's subject: a leak would rank first, not fall off the list
      await product(SHOWN_PRODUCT, "published", storefront.salesChannelId)
      await product(DRAFT_PRODUCT, "draft", storefront.salesChannelId)
      await product(OTHER_CHANNEL_PRODUCT, "published", otherChannel)
      const postId = await content("post", "Keten Gömlek Nasıl Yıkanır")
      const seen = answering()

      const answer = await draftOf(owner.headers, postId)

      expect(answer.status).toBe(201)
      const [request] = seen
      // The shown one is listed: the leave-outs below are the filters' doing, not an empty list
      expect(choicesOf(request).map((each) => each.value)).toContain(`Ürün: ${SHOWN_PRODUCT}`)
      for (const leak of [DRAFT_PRODUCT, OTHER_CHANNEL_PRODUCT]) {
        expect(request?.data).not.toContain(leak)
      }
    })

    it("refuses the whole draft when one paragraph fails the gate", async () => {
      const postId = await content("post", "Keten Gömlek Nasıl Yıkanır")
      answering((draft) => {
        const sections = draft["sections"] as { heading: string; paragraphs: string[] }[]
        const [first, second, ...rest] = sections
        return {
          ...draft,
          sections: [
            first,
            { ...second, paragraphs: ["Bu deterjan yalnız 99 TL.", ...(second?.paragraphs ?? [])] },
            ...rest,
          ],
        }
      })

      const answer = await draftOf(owner.headers, postId)

      expect([answer.status, answer.data.message]).toEqual([422, "ai.suggestion_refused"])
      expect(answer.data.problems).toContain("sections.1.paragraphs.0.price")
    })

    it("refuses a page's id and a draft for a page", async () => {
      const pageId = await content("page", "Hakkımızda")
      const seen = answering()

      const asPost = await draftOf(owner.headers, pageId)
      expect([asPost.status, asPost.data.message]).toEqual([400, "ai.unknown_entity"])
      const forPage = await ask(owner.headers, {
        task: "post_draft",
        entity_type: "page",
        entity_id: pageId,
      })
      expect([forPage.status, forPage.data.message]).toEqual([400, "ai.unknown_entity"])
      expect(seen).toHaveLength(0)
    })

    it("lets only owner and admin ask, with the shop's guidance, and counts a used draft", async () => {
      const postId = await content("post", "Keten Gömlek Nasıl Yıkanır")
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const saved = await settle(
        http.post(
          "/admin/platform-settings/ai_guidance",
          { tasks: { post_draft: { extra: "Samimi bir dil kullan." } } },
          { headers: owner.headers }
        )
      )
      expect(saved.status).toBe(200)
      const seen = answering()

      const byAdmin = await draftOf(admin.headers, postId)
      expect(byAdmin.status).toBe(201)
      expect(seen[0]?.system).toContain("Samimi bir dil kullan.")
      expect((await draftOf(operations.headers, postId)).status).toBe(403)
      expect((await draftOf(readonly.headers, postId)).status).toBe(403)
      expect(seen).toHaveLength(1)

      const id = byAdmin.data.suggestion?.id ?? ""
      const accepted = await settle(
        http.post<Answer>(`/admin/ai/suggestions/${id}/accept`, {}, { headers: owner.headers })
      )
      expect(accepted.status).toBe(200)
      const rate = await http.get<{ tasks: { task: string; accepted: number }[] }>(
        "/admin/ai/acceptance",
        { headers: owner.headers }
      )
      expect(rate.data.tasks.find((row) => row.task === "post_draft")).toMatchObject({
        accepted: 1,
      })
      // Using a draft writes nothing to the post: the panel puts it in the editor
      const draft = (await aiRecords(getContainer()).drafts()).find((each) => each.id === id)
      expect(draft).toMatchObject({ status: "approved" })
    })

    it("suggests a post's search title, description and focus keyword", async () => {
      const postId = await content("post", "Keten Gömlek Nasıl Yıkanır")
      // Asked in this order, one call each
      const texts = [TITLE, DESCRIPTION, KEYWORDS]
      const seen = answeringText(() => texts[seen.length - 1] ?? TITLE)

      const answers: { task: string; status: number; data: Answer }[] = []
      for (const task of ["seo_title", "seo_description", "focus_keyword"]) {
        answers.push({
          task,
          ...(await ask(owner.headers, { task, entity_type: "post", entity_id: postId })),
        })
      }

      for (const answer of answers) {
        expect([answer.task, answer.status, answer.data.message]).toEqual([
          answer.task,
          201,
          undefined,
        ])
        expect(answer.data.suggestion).toMatchObject({ task: answer.task, status: "draft" })
      }
      expect(seen).toHaveLength(3)
      for (const request of seen) {
        expect(request.data).toContain("Keten Gömlek Nasıl Yıkanır")
        expect(request.data).not.toContain(AUTHOR)
      }
    })
  },
})
