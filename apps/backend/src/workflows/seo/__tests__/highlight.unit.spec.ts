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

  it("never takes an attribute the shop keeps to itself (T5)", () => {
    expect(
      highlightText([
        { value_text: "TED-0042", definition: definition({ rank: 0, is_public: false }) },
        { value_text: "%100 keten", definition: definition({ rank: 1 }) },
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

  it("reads a single choice from the text column, by its option's label (adr/0013)", () => {
    const steel = definition({
      type: "select",
      label: "Namlu çeliği",
      options: [{ value: "d2", label: "D2 takım çeliği" }],
    })
    expect(highlightText([{ value_text: "d2", value_options: null, definition: steel }])).toBe(
      "D2 takım çeliği"
    )
    // An option the definition no longer lists is said by its stored value
    expect(highlightText([{ value_text: "n690", definition: steel }])).toBe("n690")
    expect(highlightText([{ value_text: null, definition: steel }])).toBeNull()
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
