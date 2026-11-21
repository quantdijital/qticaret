import {
  CATEGORY_CHOICE_LENGTH,
  TAG_CHOICES_FIELD,
  TAG_CHOICE_LENGTH,
  productPickFacts,
  sentWhole,
} from "../facts/product-picks"
import type { FactsContainer } from "../facts/types"
import { MAX_DATA_CHARS, buildPrompt } from "../prompt"
import { MAX_TAG_CHOICES } from "../registry/tasks"
import { MAX_CARD_CATEGORIES } from "../facts/product-card"

/** A shop whose every tag and category name is far too long (#251 D2). */
function longShop() {
  const long = (index: number) => `${"Çok uzun bir ad ".repeat(30)}${String(index)}`
  const query = {
    graph: (request: { entity: string; pagination?: { take?: number } }) => {
      if (request.entity === "product") {
        return Promise.resolve({ data: [{ id: "prod_1", tags: [], categories: [] }] })
      }
      if (request.entity === "product_tag") {
        const take = request.pagination?.take ?? 0
        return Promise.resolve({
          data: Array.from({ length: take }, (_, index) => ({
            id: `ptag_${String(index)}`,
            value: long(index),
          })),
        })
      }
      return Promise.resolve({
        data: Array.from({ length: MAX_CARD_CATEGORIES + 20 }, (_, index) => ({
          id: `pcat_${String(index)}`,
          name: long(index),
          is_active: true,
          is_internal: false,
          parent_category_id: null,
        })),
      })
    },
  }
  return { resolve: () => query } as FactsContainer
}

// The product's own long text, which a full block gives up first
const RECORD = { name: "Keten Gömlek", description: "uzun açıklama ".repeat(3000) }

describe("a pick's list in the data block (#251 D2)", () => {
  it("clips each name short, so a full list goes whole beside a long description", async () => {
    for (const kind of ["product_tags", "product_category"] as const) {
      const facts = await productPickFacts(longShop(), kind, "prod_1")
      const max = kind === "product_tags" ? TAG_CHOICE_LENGTH : CATEGORY_CHOICE_LENGTH
      expect(facts.allowed.choices).toHaveLength(
        kind === "product_tags" ? MAX_TAG_CHOICES : MAX_CARD_CATEGORIES
      )
      const prompt = buildPrompt({
        instruction: "x",
        fields: { ...facts.fields, ...RECORD },
        maxLengths: { description: 50_000, ...facts.maxLengths },
        maxItems: facts.maxItems,
      })
      expect(prompt.data.length).toBeLessThanOrEqual(MAX_DATA_CHARS)
      expect(sentWhole(prompt.data, facts)).toBe(true)
      const sent = (JSON.parse(prompt.data) as { data: Record<string, { value: string }[]> }).data
      const list: { value: string }[] = Object.values(sent)[0] ?? []
      // The clipped name keeps its mark: the max characters and "…"
      expect(Math.max(...list.map((each) => Array.from(each.value).length))).toBe(max + 1)
    }
  })

  it("tells a block that lost the list, or part of it, from a whole one", async () => {
    const facts = await productPickFacts(longShop(), "product_tags", "prod_1")
    const list = facts.allowed.choices.map((each) => ({ label: each.code, value: each.name }))
    const block = (value: unknown) => JSON.stringify({ data: { [TAG_CHOICES_FIELD]: value } })
    expect(sentWhole(block(list), facts)).toBe(true)
    expect(sentWhole(JSON.stringify({ data: { name: "x" } }), facts)).toBe(false)
    expect(sentWhole(block(list.slice(1)), facts)).toBe(false)
    expect(sentWhole(block([...list].reverse()), facts)).toBe(false)
    expect(sentWhole("not json", facts)).toBe(false)
    const none = { ...facts, allowed: { ...facts.allowed, choices: [] } }
    expect(sentWhole(JSON.stringify({ data: {} }), none)).toBe(true)
  })
})
