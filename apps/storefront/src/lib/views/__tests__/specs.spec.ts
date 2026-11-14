import { describe, expect, it } from "vitest"
import type { StoreAttributeValue } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { specsOf } from "../specs"

type Definition = StoreAttributeValue["definition"]

const attribute = (
  definition: Partial<Definition> & Pick<Definition, "key" | "label" | "type">,
  value: Partial<StoreAttributeValue>
): StoreAttributeValue => ({
  id: `atval_${definition.key}`,
  value_text: null,
  value_number: null,
  value_boolean: null,
  value_options: null,
  ...value,
  definition: { unit: null, rank: 0, options: null, is_seo_highlight: false, ...definition },
})

describe("specsOf", () => {
  it("reads each type as a shopper would, in the shop's order", () => {
    const specs = specsOf(
      [
        attribute(
          {
            key: "steel",
            label: "Çelik",
            type: "select",
            rank: 1,
            is_seo_highlight: true,
            options: [
              { value: "n690", label: "Böhler N690" },
              { value: "d2", label: "D2" },
            ],
          },
          // A single choice comes in `value_text` (adr/0013)
          { value_text: "n690" }
        ),
        attribute(
          { key: "length", label: "Bıçak uzunluğu", type: "number", unit: "cm", rank: 0 },
          { value_number: "21.5" }
        ),
        attribute(
          { key: "handmade", label: "El yapımı", type: "boolean", rank: 2 },
          {
            value_boolean: true,
          }
        ),
        attribute(
          {
            key: "handle",
            label: "Sap",
            type: "multi_select",
            rank: 3,
            options: [
              { value: "wood", label: "Ahşap" },
              { value: "brass", label: "Pirinç" },
            ],
          },
          { value_options: ["wood", "brass"] }
        ),
        attribute(
          { key: "origin", label: "Üretim yeri", type: "text", rank: 4 },
          {
            value_text: "  Denizli ",
          }
        ),
      ],
      t
    )

    expect(specs).toEqual([
      { label: "Bıçak uzunluğu", value: "21,5 cm", highlight: false },
      { label: "Çelik", value: "Böhler N690", highlight: true },
      { label: "El yapımı", value: "Evet", highlight: false },
      { label: "Sap", value: "Ahşap, Pirinç", highlight: false },
      { label: "Üretim yeri", value: "Denizli", highlight: false },
    ])
  })

  it("leaves out an attribute without a value, and a product without any", () => {
    expect(
      specsOf(
        [
          attribute({ key: "a", label: "Boş metin", type: "text" }, { value_text: "  " }),
          attribute({ key: "b", label: "Boş sayı", type: "number" }, { value_number: null }),
          attribute({ key: "c", label: "Boş seçim", type: "select" }, { value_text: null }),
          attribute({ key: "d", label: "Boş seçim", type: "select" }, { value_text: " " }),
          attribute({ key: "e", label: "Boş çoklu", type: "multi_select" }, { value_options: [] }),
          attribute({ key: "f", label: "Boş çoklu", type: "multi_select" }, {}),
        ],
        t
      )
    ).toEqual([])
    expect(specsOf(undefined, t)).toEqual([])
  })

  it("names a single choice by its option's label, never by what a multiple choice keeps", () => {
    const options = [
      { value: "liner-lock", label: "İçten kilitli (liner lock)" },
      { value: "back-lock", label: "Sırttan kilitli" },
    ]
    expect(
      specsOf(
        [
          attribute(
            { key: "lock", label: "Kilit sistemi", type: "select", options },
            { value_text: "liner-lock", value_options: ["back-lock"] }
          ),
        ],
        t
      )
    ).toEqual([{ label: "Kilit sistemi", value: "İçten kilitli (liner lock)", highlight: false }])
    // A multiple choice never reads the text column
    expect(
      specsOf(
        [
          attribute(
            { key: "lock", label: "Kilit sistemi", type: "multi_select", options },
            { value_text: "liner-lock" }
          ),
        ],
        t
      )
    ).toEqual([])
  })

  it("falls back to the stored value where the definition has no such option", () => {
    const specs = specsOf(
      [
        // The definition lists no options at all
        attribute({ key: "a", label: "Ağız tipi", type: "select", rank: 0 }, { value_text: "duz" }),
        // The option was taken off the list after the product chose it
        attribute(
          {
            key: "b",
            label: "Üretim şekli",
            type: "select",
            rank: 1,
            options: [{ value: "seri", label: "Seri üretim" }],
          },
          { value_text: "el-yapimi" }
        ),
        attribute(
          {
            key: "c",
            label: "Sap",
            type: "multi_select",
            rank: 2,
            options: [{ value: "wood", label: "Ahşap" }],
          },
          { value_options: ["wood", "horn"] }
        ),
      ],
      t
    )

    expect(specs.map((spec) => spec.value)).toEqual(["duz", "el-yapimi", "Ahşap, horn"])
  })
})
