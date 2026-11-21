import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { AI_REVIEWS } from "../../../modules/platform-settings/features"
import { PRODUCT_QA_MODULE } from "../../../modules/product-qa"
import { unpublishedFaqItems } from "../../../workflows/ai/accept-faq"
import { fakeTextConnector } from "../connectors/fake"
import { PUBLISHED_QUESTIONS_FIELD, productFaqFacts } from "../facts/product-faq"
import type { FactsContainer } from "../facts/types"
import { systemOf } from "../instructions"
import { NAME_MASK } from "../mask-names"
import { buildPrompt } from "../prompt"
import { foldQuestion, readFaqSuggestions } from "../product-faq"
import { PRODUCT_FAQ_TASK } from "../registry/tasks"
import { runFaqTask } from "../run-card"

/**
 * What a product's FAQ draft reads (adr/0074 §5 madde 4): the short
 * description and the published questions. A customer's question leaves
 * the shop only while `ai.reviews` is on (KVKK), its author's name masked;
 * with it off only the shop's own questions go. Every published one is
 * held on the server (`allowed`), and a kept item one already asks drops.
 */

interface Listed {
  filters: Record<string, unknown>
  config: { select?: string[]; take?: number }
}

interface Row {
  body: string
  author_name: string
  author_kind?: string
}

function containerWith(questions: Row[], customersOpen = true) {
  const listed: Listed[] = []
  const graphs: { fields: string[] }[] = []
  const flags: string[] = []
  const qa = {
    listProductQuestions: (filters: Record<string, unknown>, config: Listed["config"]) => {
      listed.push({ filters, config })
      return Promise.resolve(questions)
    },
  }
  const settings = {
    isFeatureEnabled: (key: string) => {
      flags.push(key)
      return Promise.resolve(customersOpen)
    },
  }
  const query = {
    graph: (input: { fields: string[] }) => {
      graphs.push(input)
      return Promise.resolve({
        data: [
          {
            id: "prod_1",
            product_extension: {
              summary_doc: {
                type: "doc",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Çift cidarlı termos." }] },
                ],
              },
            },
          },
        ],
      })
    },
  }
  const container: FactsContainer = {
    resolve: (key: string) => {
      if (key === PRODUCT_QA_MODULE) return qa
      if (key === PLATFORM_SETTINGS_MODULE) return settings
      return query
    },
  }
  return { container, listed, graphs, flags }
}

const MIXED: Row[] = [
  {
    body: "Merhaba ben Ayşe, kapak sızdırır mı?",
    author_name: "Ayşe K.",
    author_kind: "customer",
  },
  { body: "Kaç saat sıcak tutar?", author_name: "Örnek Mağaza", author_kind: "shop" },
]

describe("what a FAQ draft reads", () => {
  it("with AI on customers' words, sends their questions with the name masked", async () => {
    const { container, listed, graphs, flags } = containerWith(MIXED, true)
    const facts = await productFaqFacts(container, "prod_1")

    expect(flags).toEqual([AI_REVIEWS])
    expect(facts.fields[PUBLISHED_QUESTIONS_FIELD]).toEqual([
      { label: "s1", value: `Merhaba ben ${NAME_MASK}, kapak sızdırır mı?` },
      { label: "s2", value: "Kaç saat sıcak tutar?" },
    ])
    expect(facts.fields["summary"]).toBe("Çift cidarlı termos.")
    expect(JSON.stringify(facts.fields)).not.toContain("Ayşe")
    // Only published ones, by named columns: no customer id, contact or answer
    expect(listed[0]?.filters).toEqual({ product_id: "prod_1", status: "approved" })
    expect(listed[0]?.config.select).toEqual(["id", "body", "author_name", "author_kind"])
    expect(graphs[0]?.fields.join(" ")).not.toMatch(/price|inventory|stock|customer|variants/)
    expect(facts.allowed).toEqual({
      kind: "product_faq",
      published: [foldQuestion("Merhaba ben Ayşe, kapak sızdırır mı?"), "kaç saat sıcak tutar"],
    })
  })

  it("with it off, sends only the shop's own questions yet holds every one on the server", async () => {
    const { container } = containerWith(MIXED, false)
    const facts = await productFaqFacts(container, "prod_1")

    expect(facts.fields[PUBLISHED_QUESTIONS_FIELD]).toEqual([
      { label: "s1", value: "Kaç saat sıcak tutar?" },
    ])
    expect(JSON.stringify(facts.fields)).not.toContain("sızdırır")
    expect(facts.allowed).toEqual({
      kind: "product_faq",
      published: [foldQuestion("Merhaba ben Ayşe, kapak sızdırır mı?"), "kaç saat sıcak tutar"],
    })
  })

  it("names the list even when nothing is published, so the fake service knows the task", async () => {
    const { container } = containerWith([])
    const facts = await productFaqFacts(container, "prod_1")
    expect(facts.fields[PUBLISHED_QUESTIONS_FIELD]).toEqual([])
    const prompt = buildPrompt({
      instruction: systemOf(PRODUCT_FAQ_TASK, null, "product") ?? "",
      fields: { name: "Çelik Termos", ...facts.fields },
      maxLengths: facts.maxLengths,
      maxItems: facts.maxItems,
    })
    const result = await runFaqTask({
      connector: fakeTextConnector,
      task: PRODUCT_FAQ_TASK,
      prompt,
      allowed: facts.allowed,
    })
    expect(result.status).toBe("succeeded")
    const read = readFaqSuggestions(result.status === "succeeded" ? result.text : null)
    expect(read?.items).toHaveLength(3)
  })
})

describe("the kept items held against the product's published questions", () => {
  const kept = [
    { question: "Kapak sızdırır mı?", answer: "Hayır." },
    { question: "Kaç saat sıcak tutar?", answer: "12 saat." },
  ]

  it("drops one a published question already asks, folded", () => {
    expect(unpublishedFaqItems(kept, ["kapak  sızdırır mı ?"])).toEqual([
      { question: "Kaç saat sıcak tutar?", answer: "12 saat." },
    ])
    expect(unpublishedFaqItems(kept, [])).toEqual(kept)
  })

  it("refuses when every one is published already", () => {
    let thrown: unknown = null
    try {
      unpublishedFaqItems(kept, ["Kapak sızdırır mı?", "Kaç saat sıcak tutar?"])
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({ safeMessage: "ai.faq_all_published" })
  })
})
