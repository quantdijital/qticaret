import { definitionInput, duplicateKeys, productValuesSchema } from "../validation"
import type { DefinitionShape } from "../validation"

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

describe("definitionInput", () => {
  it("accepts a select with options and a variant attribute mapped to an option", () => {
    expect(
      definitionInput.safeParse({
        key: "material",
        label: "Malzeme",
        type: "select",
        options: [{ value: "steel", label: "Çelik" }],
      }).success
    ).toBe(true)
    expect(
      definitionInput.safeParse({
        key: "size",
        label: "Boyut",
        type: "select",
        options: [{ value: "m", label: "M" }],
        scope: "variant",
        option_title: "Boyut",
        varies_by: "size",
      }).success
    ).toBe(true)
  })

  it.each([
    [{ key: "Malzeme", label: "x", type: "text" }, "product_attributes.key_invalid"],
    [{ key: "constructor", label: "x", type: "text" }, "product_attributes.key_invalid"],
    [{ key: "a", label: "x\u0000", type: "text" }, "product_attributes.text_invalid"],
    [
      { key: "a", label: "x", type: "select", options: [{ value: "Çelik/Ağır", label: "Çelik" }] },
      "product_attributes.option_value_invalid",
    ],
    [{ key: "a", label: "x", type: "select" }, "product_attributes.options_required"],
    [
      { key: "a", label: "x", type: "text", options: [{ value: "v", label: "V" }] },
      "product_attributes.options_not_allowed",
    ],
    [
      {
        key: "a",
        label: "x",
        type: "select",
        options: [
          { value: "v", label: "V" },
          { value: "v", label: "W" },
        ],
      },
      "product_attributes.options_duplicate",
    ],
    [
      { key: "a", label: "x", type: "text", scope: "variant" },
      "product_attributes.option_title_required",
    ],
    [{ key: "a", label: "x", type: "text", varies_by: "color" }, "product_attributes.variant_only"],
    // Hidden from shoppers (T5): never a filter, a title's word or a product option
    [
      { key: "a", label: "x", type: "text", is_public: false, is_seo_highlight: true },
      "product_attributes.private_shown",
    ],
    [
      {
        key: "a",
        label: "x",
        type: "select",
        options: [{ value: "v", label: "V" }],
        is_public: false,
        is_filterable: true,
      },
      "product_attributes.private_shown",
    ],
    [
      {
        key: "a",
        label: "x",
        type: "text",
        scope: "variant",
        option_title: "Beden",
        is_public: false,
      },
      "product_attributes.private_shown",
    ],
  ])("refuses %p", (input, message) => {
    expect(messages(definitionInput.safeParse(input))).toContain(message)
  })

  it.each(["fiyat", "variant", "utm_kaynak"])(
    "refuses a filterable choice keyed %s, another URL parameter's name",
    (key) => {
      const parsed = definitionInput.safeParse({
        key,
        label: "x",
        type: "select",
        is_filterable: true,
        options: [{ value: "v", label: "V" }],
      })
      expect(parsed.error?.issues.map((issue) => issue.message)).toEqual([
        "product_attributes.key_reserved",
      ])
    }
  )

  it("finds repeated keys", () => {
    expect(duplicateKeys([{ key: "a" }, { key: "b" }, { key: "a" }])).toEqual(["a"])
  })
})

describe("productValuesSchema", () => {
  const definitions: DefinitionShape[] = [
    {
      key: "material",
      type: "select",
      scope: "product",
      is_required: true,
      options: [
        { value: "steel", label: "Çelik" },
        { value: "wood", label: "Ahşap" },
      ],
    },
    { key: "length_cm", type: "number", scope: "product", is_required: false, options: null },
    { key: "dishwasher", type: "boolean", scope: "product", is_required: false, options: null },
    { key: "note", type: "text", scope: "product", is_required: false, options: null },
    {
      key: "uses",
      type: "multi_select",
      scope: "product",
      is_required: false,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    },
    {
      key: "size",
      type: "select",
      scope: "variant",
      is_required: false,
      options: [{ value: "m", label: "M" }],
    },
  ]
  const schema = productValuesSchema(definitions)

  it("accepts typed values and null to clear an optional one", () => {
    expect(
      schema.safeParse({ material: "steel", length_cm: 20.5, dishwasher: false, uses: ["a", "b"] })
        .success
    ).toBe(true)
    expect(schema.safeParse({ material: "wood", length_cm: null }).success).toBe(true)
  })

  it.each([
    ["a missing required value", { length_cm: 1 }],
    ["null for a required value", { material: null }],
    ["an option not in the list", { material: "plastic" }],
    ["a number as text", { material: "steel", length_cm: "20" }],
    ["an infinite number", { material: "steel", length_cm: Infinity }],
    ["a repeated choice", { material: "steel", uses: ["a", "a"] }],
    ["a variant attribute", { material: "steel", size: "m" }],
    ["an unknown key", { material: "steel", colour: "red" }],
    ["a text over 500 characters", { material: "steel", note: "ğ".repeat(501) }],
  ])("refuses %s", (_label, values) => {
    expect(schema.safeParse(values).success).toBe(false)
  })
})
