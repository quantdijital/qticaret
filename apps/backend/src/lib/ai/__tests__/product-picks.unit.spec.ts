import { fakeTextConnector } from "../connectors/fake"
import { CATEGORY_CHOICES_FIELD, TAG_CHOICES_FIELD, productPickFacts } from "../facts/product-picks"
import type { FactsContainer } from "../facts/types"
import { buildPrompt } from "../prompt"
import {
  isPickAllowed,
  isPickTask,
  newTagProblems,
  productPicksOf,
  readProductPicks,
} from "../product-picks"
import type { PickAllowed } from "../product-picks"
import {
  MAX_TAG_CHOICES,
  PRODUCT_CATEGORY_TASK,
  PRODUCT_TAGS_TASK,
  SHORT_DESCRIPTION_TASK,
} from "../registry/tasks"
import { runPickTask } from "../run-card"

/**
 * A product's tags and categories picked from the shop's lists (adr/0074
 * §5 madde 2): a closed schema (no other key, no longer list), codes held
 * against the list read on the server, a new tag a short plain label.
 * The lists name no internal or closed category and nothing the product
 * already has; no price, stock or person is read.
 */

const TAGS: PickAllowed = {
  kind: "product_tags",
  choices: [
    { code: "e1", id: "ptag_1", name: "yazlık" },
    { code: "e2", id: "ptag_2", name: "keten" },
    { code: "e3", id: "ptag_3", name: "pamuklu" },
  ],
  taken: ["Gömlek"],
}

const CATEGORIES: PickAllowed = {
  kind: "product_category",
  choices: [
    { code: "k1", id: "pcat_1", name: "Giyim" },
    { code: "k2", id: "pcat_2", name: "Giyim > Gömlek" },
  ],
  taken: [],
}

const json = (value: unknown) => JSON.stringify(value)

describe("a pick's answer (lib/ai/product-picks.ts)", () => {
  it("names the listed records by id, new tags apart", () => {
    expect(
      productPicksOf(json({ existing: ["e2", "E1", "e2"], new: ["keten gömlek"] }), TAGS)
    ).toEqual({
      picks: {
        picked: [
          { id: "ptag_2", name: "keten" },
          { id: "ptag_1", name: "yazlık" },
        ],
        new_tags: ["keten gömlek"],
      },
    })
    expect(productPicksOf(`Yanıt: ${json({ categories: ["k2"] })}`, CATEGORIES)).toEqual({
      picks: { picked: [{ id: "pcat_2", name: "Giyim > Gömlek" }], new_tags: [] },
    })
  })

  it("refuses a code not in the list: nothing of the answer is offered", () => {
    expect(productPicksOf(json({ existing: ["e1", "e9"] }), TAGS)).toEqual({
      problems: ["unknown_code"],
    })
    // An id in place of a code, or a category the list never named
    expect(productPicksOf(json({ existing: ["ptag_1"] }), TAGS)).toEqual({
      problems: ["unknown_code"],
    })
    expect(productPicksOf(json({ categories: ["k1", "Yeni Kategori"] }), CATEGORIES)).toEqual({
      problems: ["unknown_code"],
    })
  })

  it("refuses an unknown key, a longer list and a wrong shape", () => {
    const refused = { problems: ["format"] }
    expect(productPicksOf(json({ existing: ["e1"], price: 100 }), TAGS)).toEqual(refused)
    expect(productPicksOf(json({ categories: ["k1"], reason: "uygun" }), CATEGORIES)).toEqual(
      refused
    )
    expect(
      productPicksOf(
        json({ existing: ["e1", "e2", "e3", "e1", "e2", "e3", "e1", "e2", "e3"] }),
        TAGS
      )
    ).toEqual(refused)
    expect(productPicksOf(json({ existing: [], new: ["a", "b", "c", "d"] }), TAGS)).toEqual(refused)
    expect(productPicksOf(json({ categories: ["k1", "k2", "k1", "k2"] }), CATEGORIES)).toEqual(
      refused
    )
    expect(productPicksOf(json({ categories: "k1" }), CATEGORIES)).toEqual(refused)
    // The other task's shape is not this one's
    expect(productPicksOf(json({ categories: ["k1"] }), TAGS)).toEqual(refused)
    expect(productPicksOf("etiket yok", TAGS)).toEqual(refused)
  })

  it("refuses an answer with nothing to offer", () => {
    expect(productPicksOf(json({ categories: [] }), CATEGORIES)).toEqual({ problems: ["empty"] })
    expect(productPicksOf(json({ existing: [], new: [] }), TAGS)).toEqual({ problems: ["empty"] })
  })

  it("holds a new tag to a short plain label, and refuses the answer for one that is not", () => {
    expect(newTagProblems("  yaz   sezonu ")).toEqual({ text: "yaz sezonu" })
    for (const bad of [
      "ayse.yilmaz@example.com",
      "www.ornek.com",
      "<b>kalın</b> etiket!",
      "bu etiket dört sözcükten de uzun",
      "x".repeat(41),
    ]) {
      expect([bad, "problems" in newTagProblems(bad)]).toEqual([bad, true])
    }
    const answer = productPicksOf(json({ existing: ["e1"], new: ["0532 123 45 67"] }), TAGS)
    expect("problems" in answer && answer.problems[0]?.startsWith("new.")).toBe(true)
  })

  it("takes a new tag that names a listed one as that tag, and drops one the product has", () => {
    expect(
      productPicksOf(json({ existing: [], new: ["Keten", "gömlek", "uzun kollu"] }), TAGS)
    ).toEqual({ picks: { picked: [{ id: "ptag_2", name: "keten" }], new_tags: ["uzun kollu"] } })
  })

  it("reads stored picks back, and nothing else", () => {
    const stored = json({ picked: [{ id: "pcat_1", name: "Giyim" }], new_tags: [] })
    expect(readProductPicks(stored)?.picked).toEqual([{ id: "pcat_1", name: "Giyim" }])
    expect(readProductPicks("Kısa açıklama.")).toBeNull()
    expect(readProductPicks(json({ title: "Kart" }))).toBeNull()
    expect(readProductPicks(null)).toBeNull()
  })

  it("tells pick tasks and their lists apart from a card's", () => {
    expect(isPickTask(PRODUCT_TAGS_TASK)).toBe(true)
    expect(isPickTask(PRODUCT_CATEGORY_TASK)).toBe(true)
    expect(isPickTask(SHORT_DESCRIPTION_TASK)).toBe(false)
    expect(isPickAllowed(TAGS)).toBe(true)
    expect(isPickAllowed({ categories: [], attributes: [] })).toBe(false)
  })
})

interface Asked {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
  pagination?: { take?: number; order?: Record<string, string> }
}

const category = (id: string, name: string, parent: string | null, flags = {}) => ({
  id,
  name,
  is_active: true,
  is_internal: false,
  parent_category_id: parent,
  ...flags,
})

const SHOP_CATEGORIES = [
  category("pcat_1", "Giyim", null),
  category("pcat_2", "Gömlek", "pcat_1"),
  category("pcat_3", "Toptan Gizli", null, { is_internal: true }),
  category("pcat_4", "Kapalı Sezon", null, { is_active: false }),
  category("pcat_5", "Alt Kapalı", "pcat_4"),
  category("pcat_6", "Aksesuar", null),
]

function containerWith(tagCount = 3) {
  const asked: Asked[] = []
  const tags = Array.from({ length: tagCount }, (_, index) => ({
    id: `ptag_${String(index + 1)}`,
    value: `etiket ${String(index + 1)}`,
  }))
  const query = {
    graph: (request: Asked) => {
      asked.push(request)
      if (request.entity === "product") {
        return Promise.resolve({
          data: [
            {
              id: "prod_1",
              tags: [{ id: "ptag_1", value: "etiket 1" }],
              categories: [{ id: "pcat_6" }],
            },
          ],
        })
      }
      if (request.entity === "product_tag") {
        return Promise.resolve({ data: tags.slice(0, request.pagination?.take ?? tags.length) })
      }
      return Promise.resolve({ data: SHOP_CATEGORIES })
    },
  }
  return { container: { resolve: () => query } as FactsContainer, asked }
}

describe("what a pick is asked with (lib/ai/facts/product-picks.ts)", () => {
  it("names shown categories by code, none hidden and none the product is in", async () => {
    const { container, asked } = containerWith()
    const facts = await productPickFacts(container, "product_category", "prod_1")
    expect(facts.allowed.choices).toEqual([
      { code: "k1", id: "pcat_1", name: "Giyim" },
      { code: "k2", id: "pcat_2", name: "Giyim > Gömlek" },
    ])
    const prompt = buildPrompt({ instruction: "x", fields: facts.fields, maxItems: facts.maxItems })
    expect(prompt.data).toContain(`"${CATEGORY_CHOICES_FIELD}"`)
    expect(prompt.data).not.toMatch(/pcat_|Gizli|Kapalı|Aksesuar/)
    const fields = asked.flatMap((each) => each.fields).join(",")
    expect(fields).not.toMatch(/price|stock|inventory|order|customer|created_by|metadata/)
  })

  it("names the shop's tags by code, the product's own left out, two hundred at most", async () => {
    const { container, asked } = containerWith(MAX_TAG_CHOICES + 50)
    const facts = await productPickFacts(container, "product_tags", "prod_1")
    expect(facts.allowed.choices).toHaveLength(MAX_TAG_CHOICES)
    expect(facts.allowed.choices[0]).toEqual({ code: "e1", id: "ptag_2", name: "etiket 2" })
    expect(facts.allowed.taken).toEqual(["etiket 1"])
    const prompt = buildPrompt({ instruction: "x", fields: facts.fields, maxItems: facts.maxItems })
    expect(prompt.data).toContain(`"label":"e${String(MAX_TAG_CHOICES)}"`)
    expect(prompt.data).not.toMatch(/ptag_/)
    expect(prompt.data).not.toContain('"etiket 1"')
    expect(asked.find((each) => each.entity === "product_tag")?.pagination?.order).toEqual({
      value: "ASC",
    })
    expect(facts.fields[TAG_CHOICES_FIELD]).toBeDefined()
  })

  it("refuses a product that is not there", async () => {
    const query = { graph: () => Promise.resolve({ data: [] }) }
    await expect(
      productPickFacts({ resolve: () => query } as FactsContainer, "product_tags", "prod_404")
    ).rejects.toThrow("ai.unknown_entity")
  })
})

describe("a pick's call (lib/ai/run-card.ts)", () => {
  it("asks for JSON and offers the picks as one answer; the fake service answers from the list", async () => {
    const facts = await productPickFacts(containerWith().container, "product_tags", "prod_1")
    const prompt = buildPrompt({ instruction: "x", fields: facts.fields, maxItems: facts.maxItems })
    const result = await runPickTask({
      connector: fakeTextConnector,
      task: PRODUCT_TAGS_TASK,
      prompt,
      allowed: facts.allowed,
    })
    expect(result.status).toBe("succeeded")
    const picks = result.status === "succeeded" ? readProductPicks(result.text) : null
    expect(picks?.picked.map((each) => each.id)).toEqual(["ptag_2", "ptag_3"])
  })

  it("refuses an answer naming what the list does not hold", async () => {
    const connector = {
      complete: () =>
        Promise.resolve({
          text: json({ categories: ["k9"] }),
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
    }
    const result = await runPickTask({
      connector,
      task: PRODUCT_CATEGORY_TASK,
      prompt: { system: "x", data: "{}" },
      allowed: CATEGORIES,
    })
    expect(result).toMatchObject({ status: "refused", problems: ["unknown_code"] })
  })
})
