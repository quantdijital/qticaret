import { isValidationError } from "../../../lib/errors"
import { planConversion } from "../conversion"

const OPTIONS = [
  { value: "n690", label: "N690 Böhler" },
  { value: "4116", label: "4116 paslanmaz çelik" },
]

const VALUES = [
  { id: "atval_1", value_text: "N690 Böhler" },
  { id: "atval_2", value_text: "Böhler N690" },
  { id: "atval_3", value_text: "4116 çelik (X50CrMoV15)" },
  { id: "atval_4", value_text: "Ergonomik sap" },
]

const MAPPING = [
  { from: "N690 Böhler", to: "n690" },
  { from: "Böhler N690", to: "n690" },
  { from: "4116 çelik (X50CrMoV15)", to: "4116" },
  { from: "Ergonomik sap", to: null },
]

/** The refusal's message key, or null when the plan went through. */
function refusal(run: () => unknown): string | null {
  try {
    run()
    return null
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : "not a validation error"
  }
}

describe("planConversion", () => {
  it("rewrites every stored text to its option and clears the ones mapped to nothing", () => {
    expect(planConversion(VALUES, MAPPING, OPTIONS, false)).toEqual({
      rewrite: [
        { id: "atval_1", from: "N690 Böhler", to: "n690" },
        { id: "atval_2", from: "Böhler N690", to: "n690" },
        { id: "atval_3", from: "4116 çelik (X50CrMoV15)", to: "4116" },
      ],
      clear: [{ id: "atval_4", from: "Ergonomik sap" }],
    })
  })

  it("clears a row that holds no text without asking, and ignores mappings nothing uses", () => {
    const plan = planConversion(
      [{ id: "atval_5", value_text: null }],
      [{ from: "Kullanılmayan", to: "n690" }],
      OPTIONS,
      false
    )
    expect(plan).toEqual({ rewrite: [], clear: [{ id: "atval_5", from: null }] })
  })

  it("refuses a stored text the mapping leaves out, naming it", () => {
    try {
      planConversion(VALUES, MAPPING.slice(0, 3), OPTIONS, false)
      throw new Error("no refusal")
    } catch (error) {
      expect(isValidationError(error) && error.safeMessage).toBe(
        "product_attributes.convert_unmapped"
      )
      expect(isValidationError(error) && error.values).toEqual({ value: "Ergonomik sap" })
    }
  })

  it.each([
    [
      "an option the list does not have",
      [{ from: "N690 Böhler", to: "m390" }],
      false,
      "product_attributes.option_unknown",
    ],
    [
      "a text mapped twice",
      [...MAPPING, { from: "N690 Böhler", to: "4116" }],
      false,
      "product_attributes.convert_mapping_duplicate",
    ],
    ["a required attribute's value cleared", MAPPING, true, "product_attributes.convert_required"],
  ])("refuses %s", (_, mapping, required, key) => {
    expect(refusal(() => planConversion(VALUES, mapping, OPTIONS, required))).toBe(key)
  })

  it("matches the stored text exactly: another spelling needs its own mapping", () => {
    expect(
      refusal(() =>
        planConversion(
          [{ id: "atval_6", value_text: "n690 böhler" }],
          [{ from: "N690 Böhler", to: "n690" }],
          OPTIONS,
          false
        )
      )
    ).toBe("product_attributes.convert_unmapped")
  })
})
