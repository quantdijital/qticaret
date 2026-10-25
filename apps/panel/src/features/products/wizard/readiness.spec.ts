import { describe, expect, it } from "vitest"
import { canPublish, readiness, wordCount } from "./readiness"
import { defaultWizardValues } from "./schema"
import type { WizardValues } from "./schema"

const base = defaultWizardValues()
const variant = { key: "default", title: "", options: {}, price: "", stock: "0", sku: "", ean: "" }

const complete = (): WizardValues => ({
  ...base,
  title: "Keten gömlek",
  description: Array.from({ length: 150 }, () => "kelime").join(" "),
  category_ids: ["pcat_1"],
  images: [{ id: "file_1", url: "https://example.com/a.webp" }],
  variants: [{ ...variant, price: "1.250,00" }],
  weight: "350",
  length: "30",
  width: "20",
  height: "4",
})

const state = (values: WizardValues) =>
  Object.fromEntries(readiness(values).map((item) => [item.key, item.done]))

describe("readiness", () => {
  it("passes every check for a complete product", () => {
    const items = readiness(complete())

    expect(items.every((item) => item.done)).toBe(true)
    expect(canPublish(items)).toBe(true)
  })

  it("blocks publishing without measures or a price, but not without advice", () => {
    expect(canPublish(readiness({ ...complete(), height: "" }))).toBe(false)
    expect(canPublish(readiness({ ...complete(), variants: [{ ...variant, price: "0" }] }))).toBe(
      false
    )
    expect(
      canPublish(readiness({ ...complete(), images: [], description: "kısa", category_ids: [] }))
    ).toBe(true)
  })

  it("counts words, not characters, for the description", () => {
    expect(wordCount("  bir   iki\nüç ")).toBe(3)
    expect(state({ ...complete(), description: "bir iki üç" })["description"]).toBe(false)
  })

  it("needs every variant priced", () => {
    const values = complete()
    const second = { ...variant, key: "b", price: "" }

    expect(state({ ...values, variants: [...values.variants, second] })["price"]).toBe(false)
  })
})
