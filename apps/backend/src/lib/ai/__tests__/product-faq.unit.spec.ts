import { PRODUCT_QA_MODULE } from "../../../modules/product-qa"
import { keptFaqItems } from "../../../workflows/ai/accept-faq"
import { fakeTextConnector } from "../connectors/fake"
import { PUBLISHED_QUESTIONS_FIELD, productFaqFacts } from "../facts/product-faq"
import type { FactsContainer } from "../facts/types"
import { GUIDANCE_HEADING } from "../guidance"
import { RULES_HEADING, isCraftTask, systemOf, takesGuidance } from "../instructions"
import { NAME_MASK } from "../mask-names"
import { buildPrompt } from "../prompt"
import {
  faqItemOf,
  foldQuestion,
  isFaqAllowed,
  productFaqOf,
  readFaqSuggestions,
} from "../product-faq"
import type { FaqAllowed } from "../product-faq"
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_MAX_ITEMS,
  FAQ_QUESTION_MAX_LENGTH,
  PRODUCT_ATTRIBUTES_TASK,
  PRODUCT_FAQ_TASK,
  PRODUCT_TAGS_TASK,
  findAiTask,
} from "../registry/tasks"
import { runFaqTask } from "../run-card"

/**
 * A product's FAQ draft (adr/0074 §5 madde 4): one JSON object, each item
 * gated on its own; one that fails or repeats a published question drops,
 * fewer than two left refuses the answer. The published questions go as
 * data with their authors' names masked; no price, stock or person is read.
 * Its words are prose: the shop's guidance applies.
 */

const NONE: FaqAllowed = { kind: "product_faq", published: [] }

const item = (q: string, a = "Evet, kapağı sızdırmazdır ve çantada yatay taşınabilir.") => ({
  q,
  a,
})

const answer = (items: unknown[]) => JSON.stringify({ items })

describe("a FAQ answer read against its schema and the gate", () => {
  it("takes three to five items, each one line, in order", () => {
    const result = productFaqOf(
      answer([
        item("Termos çantada yatay taşınabilir mi?"),
        item("Kaç saat sıcak tutar?", "Açıklamaya göre 12 saat sıcak, 24 saat soğuk tutar."),
        item("Bulaşık makinesinde yıkanır mı?", "Hayır, elde yıkanması önerilir."),
      ]),
      NONE
    )
    expect(result).toEqual({
      suggestions: {
        items: [
          {
            question: "Termos çantada yatay taşınabilir mi?",
            answer: "Evet, kapağı sızdırmazdır ve çantada yatay taşınabilir.",
          },
          {
            question: "Kaç saat sıcak tutar?",
            answer: "Açıklamaya göre 12 saat sıcak, 24 saat soğuk tutar.",
          },
          {
            question: "Bulaşık makinesinde yıkanır mı?",
            answer: "Hayır, elde yıkanması önerilir.",
          },
        ],
        dropped: 0,
      },
    })
  })

  it("drops an item that fails, keeps the rest, and counts the dropped", () => {
    const result = productFaqOf(
      answer([
        item("Termos çantada yatay taşınabilir mi?"),
        item("Kapak sızdırır mı?", "Hayır. Ayrıntı için https://ornek.com adresine bakın."),
        item("Rengi nedir", "Gümüş renktedir."),
        item("<b>Hacmi</b> ne kadar?", "750 ml."),
        item("Fiyatı nedir?", "Şu an 499 TL."),
        item("KAPAĞI NASIL AÇILIR?", "Kapağı çevirerek açılır."),
        item("Kim yazdı?", "Ayşe bize ayse@example.com adresinden yazdı."),
        { q: "Soru mu?", a: "Evet.", extra: true },
        item("Hacmi ne kadar?", "750 ml hacimlidir."),
      ]),
      NONE
    )
    expect(
      "suggestions" in result && result.suggestions.items.map((each) => each.question)
    ).toEqual(["Termos çantada yatay taşınabilir mi?", "Hacmi ne kadar?"])
    expect("suggestions" in result && result.suggestions.dropped).toBe(7)
  })

  it("refuses an answer with fewer than two valid items, or not of its shape", () => {
    expect(productFaqOf(answer([item("Tek soru mu?"), item("Rengi")]), NONE)).toEqual({
      problems: ["too_few_valid_items"],
    })
    expect(productFaqOf(answer([]), NONE)).toEqual({ problems: ["empty"] })
    expect(productFaqOf("Soru: …", NONE)).toEqual({ problems: ["format"] })
    expect(productFaqOf(JSON.stringify({ items: [], note: "x" }), NONE)).toEqual({
      problems: ["format"],
    })
    expect(productFaqOf(JSON.stringify({ questions: [] }), NONE)).toEqual({ problems: ["format"] })
  })

  it("keeps five items at most, and none repeating a published question or another", () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      item(`Soru numarası ${String(index + 1)} nedir?`)
    )
    const capped = productFaqOf(answer(many), NONE)
    expect("suggestions" in capped && capped.suggestions.items).toHaveLength(FAQ_MAX_ITEMS)
    expect("suggestions" in capped && capped.suggestions.dropped).toBe(2)

    const published: FaqAllowed = {
      kind: "product_faq",
      published: [foldQuestion("Termos çantada yatay taşınabilir mi?")],
    }
    const repeated = productFaqOf(
      answer([
        item("termos çantada  yatay taşınabilir mi ?"),
        item("Kaç saat sıcak tutar?"),
        item("Kaç saat sıcak tutar?"),
        item("Kapağı nasıl açılır?"),
      ]),
      published
    )
    expect(
      "suggestions" in repeated && repeated.suggestions.items.map((each) => each.question)
    ).toEqual(["Kaç saat sıcak tutar?", "Kapağı nasıl açılır?"])
  })

  it("names each item's problems, a question's and an answer's apart", () => {
    expect(faqItemOf(item("x".repeat(FAQ_QUESTION_MAX_LENGTH) + "?"))).toEqual({
      problems: ["q.length"],
    })
    expect(faqItemOf(item("Uzun mu?", "a ".repeat(FAQ_ANSWER_MAX_LENGTH)))).toEqual({
      problems: ["a.length"],
    })
    expect(faqItemOf(item("Rengi nedir", ""))).toEqual({
      problems: ["q.not_a_question", "a.empty"],
    })
    expect(faqItemOf(item("Kim sordu?", `${NAME_MASK} sordu.`))).toEqual({
      problems: ["a.masked_name"],
    })
    expect(faqItemOf(item("Fiyatı?", "₺450"))).toEqual({ problems: ["a.price"] })
    // A line break is folded: one line each
    expect(faqItemOf(item("Rengi\nnedir?", "Gümüş\n\nrenktedir."))).toEqual({
      item: { question: "Rengi nedir?", answer: "Gümüş renktedir." },
    })
  })

  it("reads stored items back, and nothing else", () => {
    const stored = JSON.stringify({ items: [{ question: "A mı?", answer: "Evet." }], dropped: 1 })
    expect(readFaqSuggestions(stored)).toEqual({
      items: [{ question: "A mı?", answer: "Evet." }],
      dropped: 1,
    })
    expect(readFaqSuggestions("düz metin")).toBeNull()
    expect(readFaqSuggestions(null)).toBeNull()
    expect(isFaqAllowed(NONE)).toBe(true)
    expect(isFaqAllowed({ kind: "product_tags", choices: [] })).toBe(false)
  })
})

describe("the items a person kept, before they are stored", () => {
  it("passes them through the same check, a repeat once", () => {
    expect(
      keptFaqItems([
        { q: "Kaç saat sıcak tutar?", a: "12 saat." },
        { q: "kaç saat sıcak tutar ?", a: "On iki saat." },
        { q: "Kapağı nasıl açılır?", a: "Çevirerek." },
      ])
    ).toEqual([
      { question: "Kaç saat sıcak tutar?", answer: "12 saat." },
      { question: "Kapağı nasıl açılır?", answer: "Çevirerek." },
    ])
  })

  it("refuses the request for an edit the gate would not take, naming the item", () => {
    for (const bad of [
      { q: "Nereden alınır?", a: "www.ornek.com" },
      { q: "Rengi nedir", a: "Gümüş." },
      { q: "Ne kadar?", a: "199 TL" },
      { q: "Kim?", a: "<script>x</script>" },
      { q: "Kim?", a: "0532 123 45 67 numarasını arayın." },
    ]) {
      let thrown: unknown = null
      try {
        keptFaqItems([{ q: "Kapağı nasıl açılır?", a: "Çevirerek." }, bad])
      } catch (error) {
        thrown = error
      }
      expect(thrown).toMatchObject({ safeMessage: "ai.faq_item_invalid", field: "items.1" })
    }
  })
})

interface Listed {
  filters: Record<string, unknown>
  config: { select?: string[]; take?: number }
}

function containerWith(questions: { body: string; author_name: string; author_kind?: string }[]) {
  const listed: Listed[] = []
  const graphs: { fields: string[] }[] = []
  const qa = {
    listProductQuestions: (filters: Record<string, unknown>, config: Listed["config"]) => {
      listed.push({ filters, config })
      return Promise.resolve(questions)
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
    resolve: (key: string) => (key === PRODUCT_QA_MODULE ? qa : query),
  }
  return { container, listed, graphs }
}

describe("what a FAQ draft reads", () => {
  it("sends the published questions with a customer's name masked, never as a fact", async () => {
    const { container, listed, graphs } = containerWith([
      {
        body: "Merhaba ben Ayşe, kapak sızdırır mı?",
        author_name: "Ayşe K.",
        author_kind: "customer",
      },
      { body: "Kaç saat sıcak tutar?", author_name: "Örnek Mağaza", author_kind: "shop" },
    ])
    const facts = await productFaqFacts(container, "prod_1")

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

describe("the FAQ task", () => {
  it("is a product's JSON task for owner and admin, in the registry", () => {
    expect(findAiTask("product_faq")).toBe(PRODUCT_FAQ_TASK)
    expect(PRODUCT_FAQ_TASK).toMatchObject({
      capability: "text",
      json: true,
      gate: "product_faq",
      entities: ["product"],
      keepData: false,
    })
    expect(PRODUCT_FAQ_TASK.roles).toEqual(["owner", "admin"])
    expect(PRODUCT_FAQ_TASK.flag).toBeUndefined()
  })

  it("takes the shop's guidance and the owner's craft as prose, unlike picks and values", () => {
    expect(takesGuidance(PRODUCT_FAQ_TASK)).toBe(true)
    expect(isCraftTask("product_faq")).toBe(true)
    for (const task of [PRODUCT_TAGS_TASK, PRODUCT_ATTRIBUTES_TASK]) {
      expect(takesGuidance(task)).toBe(false)
    }
    const guidance = `${GUIDANCE_HEADING}\nSiz diye hitap et.`
    const system = systemOf(PRODUCT_FAQ_TASK, null, "product", guidance) ?? ""
    // The layers' order: craft, guidance, then the fixed rules with the JSON shape, last
    const craftAt = system.indexOf("Rol: ")
    const guidanceAt = system.indexOf(GUIDANCE_HEADING)
    const rulesAt = system.indexOf(RULES_HEADING)
    expect(craftAt).toBeGreaterThan(-1)
    expect(guidanceAt).toBeGreaterThan(craftAt)
    expect(rulesAt).toBeGreaterThan(guidanceAt)
    expect(system.slice(rulesAt)).toContain('"items"')
    expect(system.slice(rulesAt)).toContain("kargo")
  })
})
