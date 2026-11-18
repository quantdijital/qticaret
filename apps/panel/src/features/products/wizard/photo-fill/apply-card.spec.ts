import { describe, expect, it, vi } from "vitest"
import type { AttributeDefinition } from "@/features/attributes/types"
import { readProductCard } from "@/features/ai/product-card"
import { EMPTY_SUMMARY } from "@/features/products/summary-doc"
import { defaultWizardValues } from "../schema"
import { cardFields } from "./apply-card"

vi.mock("@/lib/sdk", () => ({ sdk: {} }))

const definition = (over: Partial<AttributeDefinition>): AttributeDefinition => ({
  id: `def_${over.key ?? "x"}`,
  key: "x",
  label: "X",
  type: "text",
  unit: null,
  options: null,
  rank: 0,
  is_required: false,
  is_filterable: false,
  is_seo_highlight: false,
  scope: "product",
  option_title: null,
  varies_by: null,
  ...over,
})

const DEFINITIONS = [
  definition({
    key: "material",
    label: "Malzeme",
    type: "select",
    options: [
      { value: "wood", label: "Ahşap" },
      { value: "steel", label: "Çelik" },
    ],
  }),
  definition({ key: "length", label: "Uzunluk", type: "number", unit: "cm" }),
]

const PHOTO = { id: "file_new", url: "https://cdn.example.com/yeni.webp" }
const CATEGORIES = new Set(["pcat_1", "pcat_2"])

describe("what Kullan puts in the new product form", () => {
  it("fills the name, short description, category, attributes and the photo first", () => {
    const values = {
      ...defaultWizardValues(),
      category_ids: ["pcat_1"],
      images: [{ id: "file_old", url: "https://cdn.example.com/eski.webp" }],
      attributes: { length: 10 },
    }
    const next = cardFields(
      values,
      {
        title: "Ahşap kesme tahtası",
        short_description: "Zeytin ağacından.\nYağlı yüzey.",
        category_id: "pcat_2",
        attributes: { material: "wood", length: 32.5 },
      },
      PHOTO,
      DEFINITIONS,
      CATEGORIES
    )
    expect(next.title).toBe("Ahşap kesme tahtası")
    expect(next.summary_doc.content).toHaveLength(2)
    expect(next.category_ids).toEqual(["pcat_1", "pcat_2"])
    expect(next.attributes).toEqual({ material: "wood", length: 32.5 })
    expect(next.images.map((image) => image.id)).toEqual(["file_new", "file_old"])
  })

  it("drops a category or an attribute value the form does not know", () => {
    const values = defaultWizardValues()
    const next = cardFields(
      values,
      {
        title: "Kupa",
        short_description: null,
        category_id: "pcat_404",
        attributes: { material: "plastic", weight: 3, length: "uzun" },
      },
      PHOTO,
      DEFINITIONS,
      CATEGORIES
    )
    expect(next.category_ids).toEqual([])
    expect(next.attributes).toEqual({})
    expect(next.summary_doc).toBe(EMPTY_SUMMARY)
  })

  it("adds the photo once, however often Kullan is pressed", () => {
    const values = { ...defaultWizardValues(), images: [PHOTO] }
    const card = { title: "Kupa", short_description: null, category_id: null, attributes: {} }
    expect(cardFields(values, card, PHOTO, [], CATEGORIES).images).toEqual([PHOTO])
  })
})

describe("the card as the panel reads it", () => {
  it("keeps the four fields; a price, stock or status in the answer is never read", () => {
    expect(
      readProductCard({
        title: "Kupa",
        short_description: "Beyaz.",
        category_id: "pcat_1",
        attributes: { material: "wood", bad: { nested: true }, n: Number.NaN },
        price: 1,
        stock: 9,
        status: "published",
      })
    ).toEqual({
      title: "Kupa",
      short_description: "Beyaz.",
      category_id: "pcat_1",
      attributes: { material: "wood" },
    })
    expect(readProductCard({ title: "" })).toBeNull()
    expect(readProductCard(null)).toBeNull()
  })
})
