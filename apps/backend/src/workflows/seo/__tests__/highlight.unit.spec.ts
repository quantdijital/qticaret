import { highlightText } from "../highlight"

const definition = (overrides: Record<string, unknown>) => ({
  label: "Malzeme",
  type: "text",
  unit: null,
  rank: 0,
  options: null,
  is_seo_highlight: true,
  ...overrides,
})

describe("highlightText", () => {
  it("reads the first highlighted attribute by rank, as a shopper would", () => {
    expect(
      highlightText([
        { value_number: 20, definition: definition({ type: "number", unit: "cm", rank: 2 }) },
        { value_text: "%100 keten", definition: definition({ rank: 1 }) },
        { value_text: "Gizli", definition: definition({ rank: 0, is_seo_highlight: false }) },
      ])
    ).toBe("%100 keten")
  })

  it("names chosen options by their labels and skips empty values", () => {
    expect(
      highlightText([
        { value_text: "", definition: definition({}) },
        {
          value_options: ["red", "blue"],
          definition: definition({
            type: "multi_select",
            rank: 1,
            options: [
              { value: "red", label: "Kırmızı" },
              { value: "blue", label: "Mavi" },
            ],
          }),
        },
      ])
    ).toBe("Kırmızı, Mavi")
  })

  it("says a true flag by its label and nothing otherwise", () => {
    const flag = definition({ type: "boolean", label: "Bulaşık makinesinde yıkanabilir" })
    expect(highlightText([{ value_boolean: true, definition: flag }])).toBe(
      "Bulaşık makinesinde yıkanabilir"
    )
    expect(highlightText([{ value_boolean: false, definition: flag }])).toBeNull()
    expect(highlightText([])).toBeNull()
  })
})
