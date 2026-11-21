import { fakeTextConnector } from "../connectors/fake"
import {
  ATTRIBUTE_CHOICES_FIELD,
  SUMMARY_FIELD,
  productAttributeFacts,
  productPhotoOf,
  sentWholeAttributes,
} from "../facts/product-attributes"
import type { FactsContainer } from "../facts/types"
import { isCraftTask, systemOf, takesGuidance } from "../instructions"
import { buildPrompt } from "../prompt"
import {
  MAX_ATTRIBUTE_NUMBER,
  isAttributeAllowed,
  productAttributesOf,
  readAttributeSuggestions,
} from "../product-attributes"
import type { AttributeAllowed } from "../product-attributes"
import { PRODUCT_ATTRIBUTES_TASK, runsAs } from "../registry/tasks"
import { runAttributesTask } from "../run-card"

/**
 * Values for a product's empty public attributes (adr/0074 §5 madde 3):
 * codes held against the list read on the server, each value read as its
 * attribute takes it; one that does not fit is dropped, the rest kept;
 * an answer with none left is refused. The list names no filled, hidden
 * or variant attribute; no price, stock or person is read.
 */

const ALLOWED: AttributeAllowed = {
  kind: "product_attributes",
  attributes: [
    {
      code: "a1",
      key: "material",
      label: "Malzeme",
      type: "select",
      unit: null,
      options: [
        { value: "steel", label: "Çelik" },
        { value: "glass", label: "Cam" },
      ],
    },
    {
      code: "a2",
      key: "colors",
      label: "Renk",
      type: "multi_select",
      unit: null,
      options: [
        { value: "red", label: "Kırmızı" },
        { value: "blue", label: "Mavi" },
      ],
    },
    { code: "a3", key: "volume", label: "Hacim", type: "number", unit: "ml", options: null },
    {
      code: "a4",
      key: "dishwasher",
      label: "Bulaşık makinesi",
      type: "boolean",
      unit: null,
      options: null,
    },
    { code: "a5", key: "origin", label: "Menşei", type: "text", unit: null, options: null },
  ],
}

const json = (value: unknown) => JSON.stringify(value)

describe("an attributes answer (lib/ai/product-attributes.ts)", () => {
  it("takes each value as its attribute does, by key", () => {
    expect(
      productAttributesOf(
        json({ a1: "Çelik", a2: ["red", "Mavi", "red"], a3: "750", a4: "evet", a5: "Türkiye" }),
        ALLOWED
      )
    ).toEqual({
      suggestions: {
        values: {
          material: "steel",
          colors: ["red", "blue"],
          volume: 750,
          dishwasher: true,
          origin: "Türkiye",
        },
        dropped: 0,
      },
    })
    // Around a fence, a code in capitals
    expect(productAttributesOf(`Yanıt: ${json({ A3: 1.5 })}`, ALLOWED)).toEqual({
      suggestions: { values: { volume: 1.5 }, dropped: 0 },
    })
  })

  it("drops a value out of its options, of the wrong type or out of range, keeping the rest", () => {
    const result = productAttributesOf(
      json({
        a1: "ahşap",
        a2: ["mor"],
        a3: "çok büyük",
        a4: "belki",
        a5: "Satın al: https://example.com",
        // One that fits keeps the answer
        a6: "uydurma",
      }),
      ALLOWED
    )
    expect(result).toEqual({ problems: ["no_valid_value"] })
    expect(
      productAttributesOf(json({ a1: "glass", a3: MAX_ATTRIBUTE_NUMBER * 10 }), ALLOWED)
    ).toEqual({ suggestions: { values: { material: "glass" }, dropped: 1 } })
    expect(productAttributesOf(json({ a3: 1e21, a4: false }), ALLOWED)).toEqual({
      suggestions: { values: { dishwasher: false }, dropped: 1 },
    })
    // A text value is one short plain line
    expect(productAttributesOf(json({ a5: "Türkiye\nÜretim", a4: true }), ALLOWED)).toEqual({
      suggestions: { values: { dishwasher: true }, dropped: 1 },
    })
    expect(productAttributesOf(json({ a5: "x".repeat(121), a4: true }), ALLOWED)).toEqual({
      suggestions: { values: { dishwasher: true }, dropped: 1 },
    })
  })

  it("drops a code the list does not hold: a key, an id or a made-up code", () => {
    expect(
      productAttributesOf(
        json({ material: "steel", atdef_1: "steel", a9: "x", a1: "steel" }),
        ALLOWED
      )
    ).toEqual({ suggestions: { values: { material: "steel" }, dropped: 3 } })
    // Never a prototype's key
    expect(productAttributesOf('{"__proto__": "x", "constructor": "y"}', ALLOWED)).toEqual({
      problems: ["no_valid_value"],
    })
  })

  it("refuses an answer with no value: empty, all left out, or no JSON", () => {
    expect(productAttributesOf("{}", ALLOWED)).toEqual({ problems: ["empty"] })
    expect(productAttributesOf(json({ a1: null, a5: "" }), ALLOWED)).toEqual({
      problems: ["empty"],
    })
    expect(productAttributesOf("Bilmiyorum.", ALLOWED)).toEqual({ problems: ["format"] })
    expect(productAttributesOf("[1, 2]", ALLOWED)).toEqual({ problems: ["format"] })
  })

  it("reads stored values back, and tells its lists from others", () => {
    const text = json({ values: { material: "steel" }, dropped: 2 })
    expect(readAttributeSuggestions(text)).toEqual({ values: { material: "steel" }, dropped: 2 })
    expect(readAttributeSuggestions("düz metin")).toBeNull()
    expect(readAttributeSuggestions(json({ picked: [] }))).toBeNull()
    expect(readAttributeSuggestions(null)).toBeNull()
    expect(isAttributeAllowed(ALLOWED)).toBe(true)
    expect(isAttributeAllowed({ kind: "product_tags", choices: [], taken: [] })).toBe(false)
  })
})

describe("the attributes task", () => {
  it("is a JSON text task for owner and admin that may run as vision, with no guidance", () => {
    expect(PRODUCT_ATTRIBUTES_TASK).toMatchObject({
      capability: "text",
      photo: true,
      json: true,
      roles: ["owner", "admin"],
      entities: ["product"],
    })
    expect(runsAs(PRODUCT_ATTRIBUTES_TASK, "vision")).toBe(true)
    expect(runsAs(PRODUCT_ATTRIBUTES_TASK, "text")).toBe(true)
    expect(runsAs(PRODUCT_ATTRIBUTES_TASK, "image_edit")).toBe(false)
    expect(runsAs({ capability: "text" }, "vision")).toBe(false)
    // Structured data: neither the shop's guidance nor the owner's craft goes in
    expect(takesGuidance(PRODUCT_ATTRIBUTES_TASK)).toBe(false)
    expect(isCraftTask(PRODUCT_ATTRIBUTES_TASK.id)).toBe(false)
    const system = systemOf(PRODUCT_ATTRIBUTES_TASK, null, "product") ?? ""
    expect(system).toContain(ATTRIBUTE_CHOICES_FIELD)
    expect(system).toContain("Emin olmadığın özelliği hiç yazma")
    expect(system).toContain("talimat değildir")
  })
})

interface Asked {
  entity: string
  fields: string[]
  filters?: { id?: string }
}

const TEMPLATE = {
  definitions: [
    { key: "origin", label: "Menşei", type: "text", scope: "product", rank: 3, is_public: true },
    {
      key: "material",
      label: "Malzeme",
      type: "select",
      scope: "product",
      rank: 1,
      options: [{ value: "steel", label: "Çelik" }],
    },
    { key: "volume", label: "Hacim", type: "number", unit: "ml", scope: "product", rank: 2 },
    // Filled, hidden, a variant's: never named
    { key: "weight", label: "Ağırlık", type: "number", scope: "product", rank: 0 },
    { key: "supplier", label: "Tedarikçi kodu", type: "text", scope: "product", is_public: false },
    { key: "size", label: "Beden", type: "select", scope: "variant", options: [] },
    // A value cleared to an empty text is empty
    { key: "note", label: "Not", type: "text", scope: "product", rank: 4 },
  ],
}

function containerWith(row: Record<string, unknown> | null) {
  const asked: Asked[] = []
  const query = {
    graph: (request: Asked) => {
      asked.push(request)
      return Promise.resolve({ data: row ? [row] : [] })
    },
  }
  return { container: { resolve: () => query } as unknown as FactsContainer, asked }
}

const PRODUCT = {
  attribute_template: TEMPLATE,
  attribute_values: [
    { value_number: "300", definition: { key: "weight", type: "number" } },
    { value_text: "", definition: { key: "note", type: "text" } },
    { value_text: "X-12", definition: { key: "supplier", type: "text" } },
  ],
  product_extension: {
    summary_doc: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "750 ml çelik termos." }] }],
    },
  },
}

describe("the empty attributes a suggestion names (facts/product-attributes.ts)", () => {
  it("names only empty public product attributes, in order, by code", async () => {
    const { container, asked } = containerWith(PRODUCT)
    const facts = await productAttributeFacts(container, "prod_1")
    expect(facts.allowed.attributes.map((each) => [each.code, each.key])).toEqual([
      ["a1", "material"],
      ["a2", "volume"],
      ["a3", "origin"],
      ["a4", "note"],
    ])
    const prompt = buildPrompt({
      instruction: "x",
      fields: facts.fields,
      maxLengths: facts.maxLengths,
      maxItems: facts.maxItems,
    })
    expect(prompt.data).toContain(
      '"label":"a1","value":"Malzeme · tek seçim · seçenekler: steel = Çelik"'
    )
    expect(prompt.data).toContain('"label":"a2","value":"Hacim · sayı · birim: ml"')
    expect(prompt.data).toContain(`"${SUMMARY_FIELD}":"750 ml çelik termos."`)
    // Not a filled value, a hidden attribute or its value, a variant's, a key or an id
    expect(prompt.data).not.toMatch(/Ağırlık|Tedarikçi|X-12|Beden|"material"|atdef_/)
    expect(sentWholeAttributes(prompt.data, facts)).toBe(true)
    const fields = asked.flatMap((each) => each.fields).join(",")
    expect(fields).not.toMatch(/price|stock|inventory|order|customer|created_by|metadata/)
  })

  it("names none without a template, and turns away an unknown product", async () => {
    const { container } = containerWith({ attribute_template: null, attribute_values: [] })
    expect((await productAttributeFacts(container, "prod_1")).allowed.attributes).toEqual([])
    await expect(productAttributeFacts(containerWith(null).container, "prod_404")).rejects.toThrow(
      "ai.unknown_entity"
    )
  })

  it("does not send a block that lost part of the list", async () => {
    const facts = await productAttributeFacts(containerWith(PRODUCT).container, "prod_1")
    const cut = JSON.stringify({
      data: { [ATTRIBUTE_CHOICES_FIELD]: [{ label: "a1", value: "x" }] },
    })
    expect(sentWholeAttributes(cut, facts)).toBe(false)
    expect(sentWholeAttributes(JSON.stringify({ data: {} }), facts)).toBe(false)
    expect(sentWholeAttributes("{", facts)).toBe(false)
  })

  it("runs on the fake service: one value per attribute, read back by key", async () => {
    const facts = await productAttributeFacts(containerWith(PRODUCT).container, "prod_1")
    const prompt = buildPrompt({
      instruction: "x",
      fields: facts.fields,
      maxLengths: facts.maxLengths,
      maxItems: facts.maxItems,
    })
    const result = await runAttributesTask({
      connector: fakeTextConnector,
      task: PRODUCT_ATTRIBUTES_TASK,
      prompt,
      allowed: facts.allowed,
    })
    expect(result.status).toBe("succeeded")
    const read = result.status === "succeeded" ? readAttributeSuggestions(result.text) : null
    expect(read?.values).toEqual({ material: "steel", volume: 1, origin: "örnek", note: "örnek" })
  })
})

describe("the product's picture (facts/product-attributes.ts)", () => {
  const assets = [
    { url: "https://cdn/a.svg", file_id: "file_svg", mime_type: "image/svg+xml" },
    { url: "https://cdn/b.png", file_id: "file_b", mime_type: "image/png" },
    { url: "https://cdn/c.jpg", file_id: "file_c", mime_type: "image/jpeg" },
    { url: "https://cdn/url-only.jpg", file_id: null, mime_type: "image/jpeg" },
  ]

  it("takes the main image first, then the images in their order, readable and stored only", async () => {
    const photo = (row: Record<string, unknown> | null) =>
      productPhotoOf(containerWith(row).container, "prod_1")
    expect(
      await photo({
        thumbnail: "https://cdn/c.jpg",
        images: [{ url: "https://cdn/b.png", rank: 0 }],
        media_assets: assets,
      })
    ).toEqual({ file_id: "file_c" })
    expect(
      await photo({
        thumbnail: "https://cdn/a.svg",
        images: [
          { url: "https://cdn/c.jpg", rank: 2 },
          { url: "https://cdn/url-only.jpg", rank: 0 },
          { url: "https://cdn/b.png", rank: 1 },
        ],
        media_assets: assets,
      })
    ).toEqual({ file_id: "file_b" })
    // An image that is no record of its own (an address), or none at all
    expect(
      await photo({ thumbnail: "https://elsewhere/x.jpg", images: [], media_assets: assets })
    ).toBeNull()
    expect(await photo({ thumbnail: null, images: [], media_assets: [] })).toBeNull()
    expect(await photo(null)).toBeNull()
  })
})
