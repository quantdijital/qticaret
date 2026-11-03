import { kurus } from "../../../money"
import {
  AddonsInput,
  addonInvoiceParts,
  addonTextProblem,
  addonUnitPrice,
  chooseAddons,
  isNonWithdrawableLine,
  isStalePrice,
  lineAddonProblem,
  lineAddons,
  lineAddonsOf,
  plainAddonText,
  selectionsOf,
  storedAddonsOf,
  toStoredAddons,
  withoutAddonTexts,
} from ".."
import type { ChosenAddon, StoredAddon } from ".."

const engraving = {
  kind: "text" as const,
  label: "Ürün üzerine yazı",
  price: 35,
  max_quantity: 10,
  non_withdrawable: true,
  text: { max_length: 50 },
}
const sheath = {
  kind: "choice" as const,
  label: "Kılıf",
  choices: [
    { label: "Desenli Siyah", price: 300 },
    { label: "Desensiz Kahverengi", price: 250.5 },
  ],
}

let next = 0
const ids = (prefix: "ad" | "ch") => `${prefix}_${String((next += 1))}`

const issues = (value: unknown) => {
  const parsed = AddonsInput.safeParse(value)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

const stored = (): StoredAddon[] => toStoredAddons(AddonsInput.parse([engraving, sheath]), ids)

describe("product add-ons (adr/0052)", () => {
  it("takes up to five add-ons with their limits, and stores them with ids and defaults", () => {
    const [text, choice] = stored()

    expect(text).toMatchObject({
      kind: "text",
      label: "Ürün üzerine yazı",
      help: null,
      required: false,
      price: 35,
      max_quantity: 10,
      non_withdrawable: true,
      text: { max_length: 50, charset: "letters_digits" },
    })
    expect(text?.id).toMatch(/^ad_/u)
    expect(choice).toMatchObject({ kind: "choice", non_withdrawable: false, max_quantity: null })
    expect(choice?.kind === "choice" ? choice.choices.map((each) => each.id) : []).toEqual([
      expect.stringMatching(/^ch_/u) as unknown,
      expect.stringMatching(/^ch_/u) as unknown,
    ])
    // Stored under `items`; anything else reads as none
    expect(storedAddonsOf({ items: [text, choice] })).toHaveLength(2)
    expect(storedAddonsOf([text])).toEqual([])
    expect(storedAddonsOf(null)).toEqual([])
  })

  it.each([
    ["six add-ons", Array.from({ length: 6 }, () => engraving), "addons.too_many"],
    ["a name of 61 characters", [{ ...engraving, label: "a".repeat(61) }], "addons.label_invalid"],
    ["a price below a kuruş", [{ ...engraving, price: 35.001 }], "addons.price_invalid"],
    ["a negative price", [{ ...engraving, price: -1 }], "addons.price_invalid"],
    ["a price over the limit", [{ ...engraving, price: 10_000.01 }], "addons.price_invalid"],
    ["a text over 200", [{ ...engraving, text: { max_length: 201 } }], "addons.text_rules_invalid"],
    ["one choice", [{ ...sheath, choices: [sheath.choices[0]] }], "addons.choices_invalid"],
    [
      "eleven choices",
      [{ ...sheath, choices: Array.from({ length: 11 }, () => sheath.choices[0]) }],
      "addons.choices_invalid",
    ],
    ["a paid text required", [{ ...engraving, required: true }], "addons.required_must_be_free"],
    ["a paid choice required", [{ ...sheath, required: true }], "addons.required_must_be_free"],
    [
      "an id twice",
      [
        { ...engraving, id: "a" },
        { ...sheath, id: "a" },
      ],
      "addons.id_duplicate",
    ],
    ["a client's price field", [{ ...engraving, unit_price: 1 }], undefined],
  ])("refuses %s", (_name, addons, key) => {
    const found = issues(addons)
    expect(found.length).toBeGreaterThan(0)
    if (key) {
      expect(found).toContain(key)
    }
  })

  it("lets a free add-on be required", () => {
    expect(issues([{ ...engraving, price: 0, required: true }])).toEqual([])
    expect(issues([])).toEqual([])
  })

  it("holds a typed text to letters, digits and spaces, Turkish ones too, and never a link", () => {
    const rules = { max_length: 10, charset: "letters_digits" as const }

    expect(plainAddonText("  Ayşe\n  Çağrı ")).toBe("Ayşe Çağrı")
    // NFC: a decomposed ş is one character
    expect(plainAddonText("ş").length).toBe(1)
    expect(addonTextProblem("Ayşe Çağrı", rules)).toBeNull()
    expect(addonTextProblem("İĞÜŞÖÇ 2026", { ...rules, max_length: 11 })).toBeNull()
    expect(addonTextProblem("", rules)).toBe("addons.text_required")
    expect(addonTextProblem("a".repeat(11), rules)).toBe("addons.text_too_long")
    expect(addonTextProblem("Ali!", rules)).toBe("addons.charset")
    expect(addonTextProblem("A​li", rules)).toBe("addons.charset")
    expect(addonTextProblem("https://kotu.example", { ...rules, max_length: 50 })).toBe(
      "addons.text_link"
    )
    expect(addonTextProblem("www.kotu.example", { ...rules, max_length: 50 })).toBe(
      "addons.text_link"
    )
    expect(addonTextProblem("ali@kotu.example", { ...rules, max_length: 50 })).toBe(
      "addons.text_link"
    )
    // The wider set takes punctuation, still no address
    const text = { max_length: 50, charset: "text" as const }
    expect(addonTextProblem("Ali & Ayşe, 1.5", text)).toBeNull()
    expect(addonTextProblem("kotu.com", text)).toBe("addons.text_link")
  })

  it("prices the picks in the product's order, refuses unknown ones and checks the line", () => {
    const addons = stored()
    const [text, choice] = addons
    const choiceId = choice?.kind === "choice" ? (choice.choices[1]?.id ?? "") : ""

    const result = chooseAddons(addons, [
      { addon_id: choice?.id ?? "", choice_id: choiceId },
      { addon_id: text?.id ?? "", value: "  Ahmet " },
    ])
    const chosen = "chosen" in result ? result.chosen : []

    expect(
      chosen.map((each) => [each.label, each.value ?? each.choice_label, each.amount])
    ).toEqual([
      ["Ürün üzerine yazı", "Ahmet", 35],
      ["Kılıf", "Desensiz Kahverengi", 250.5],
    ])
    // 1.200,00 + 35,00 + 250,50, in kuruş
    expect(addonUnitPrice(kurus(120_000), chosen)).toBe(148_550)
    expect(lineAddonProblem(addons, chosen, 10)).toBeNull()
    expect(lineAddonProblem(addons, chosen, 11)).toEqual({
      key: "addons.max_quantity",
      field: "quantity",
    })
    expect(chooseAddons(addons, [{ addon_id: "ad_none" }])).toEqual({
      problem: { key: "addons.unknown", field: "selections.0.addon_id" },
    })
    expect(chooseAddons(addons, [{ addon_id: choice?.id ?? "", choice_id: "ch_none" }])).toEqual({
      problem: { key: "addons.unknown", field: "selections.0.choice_id" },
    })
    expect(
      chooseAddons(addons, [{ addon_id: text?.id ?? "", value: "bkz. https://kotu.example" }])
    ).toEqual({ problem: { key: "addons.text_link", field: "selections.0.value" } })
    expect(
      chooseAddons(addons, [
        { addon_id: text?.id ?? "", value: "A" },
        { addon_id: text?.id ?? "", value: "B" },
      ])
    ).toEqual({ problem: { key: "addons.duplicate", field: "selections.1.addon_id" } })
    const required = addons.map((addon) => ({ ...addon, required: true }))
    expect(lineAddonProblem(required, chosen.slice(0, 1), 1)).toEqual({
      key: "addons.required",
      field: "selections",
    })
  })

  it("finds a line stale when its unit price is not what its add-ons cost now", () => {
    expect(isStalePrice({ unit_price: 1235, is_custom_price: true }, kurus(123_500))).toBe(false)
    expect(isStalePrice({ unit_price: "1235.00", is_custom_price: true }, kurus(123_500))).toBe(
      false
    )
    // A price list ended: the base went up
    expect(isStalePrice({ unit_price: 1035, is_custom_price: true }, kurus(123_500))).toBe(true)
    // Not a custom price: Medusa would drop the add-ons at its next refresh
    expect(isStalePrice({ unit_price: 1235, is_custom_price: false }, kurus(123_500))).toBe(true)
  })

  it("keeps a line's record: withdrawal, invoice words without the text, and its erasure", () => {
    const addons = stored()
    const [text, choice] = addons
    const result = chooseAddons(addons, [
      { addon_id: text?.id ?? "", value: "Ahmet" },
      {
        addon_id: choice?.id ?? "",
        choice_id: choice?.kind === "choice" ? (choice.choices[0]?.id ?? "") : "",
      },
    ])
    const chosen: ChosenAddon[] = "chosen" in result ? result.chosen : []
    const metadata = { other: 1, qt_addons: lineAddons(chosen, 1200, 10) }

    const read = lineAddonsOf(metadata)
    const erased = withoutAddonTexts(metadata)

    expect(read).toMatchObject({ base: 1200, non_withdrawable: true, max_quantity: 10 })
    expect(selectionsOf(read ?? lineAddons([], 0, null))).toEqual([
      { addon_id: text?.id, value: "Ahmet" },
      { addon_id: choice?.id, choice_id: expect.any(String) as unknown },
    ])
    expect(isNonWithdrawableLine(metadata)).toBe(true)
    expect(isNonWithdrawableLine({ qt_addons: lineAddons(chosen.slice(1), 1200, null) })).toBe(
      false
    )
    expect(isNonWithdrawableLine(null)).toBe(false)
    expect(addonInvoiceParts(metadata)).toEqual(["Ürün üzerine yazı", "Kılıf: Desenli Siyah"])
    expect(JSON.stringify(addonInvoiceParts(metadata))).not.toContain("Ahmet")
    expect(erased).toMatchObject({ other: 1 })
    expect(JSON.stringify(erased)).not.toContain("Ahmet")
    expect(lineAddonsOf(erased)?.items.map((item) => [item.label, item.amount])).toEqual([
      ["Ürün üzerine yazı", 35],
      ["Kılıf", 300],
    ])
    // Erased once, nothing more to do; a line without add-ons is not touched
    expect(withoutAddonTexts(erased)).toBeNull()
    expect(withoutAddonTexts({ other: 1 })).toBeNull()
  })
})
