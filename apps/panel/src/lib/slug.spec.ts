import { describe, expect, it } from "vitest"
import { isValidSlug, toSlug } from "./slug"

describe("toSlug", () => {
  it.each([
    ["Şef Bıçağı 20 cm", "sef-bicagi-20-cm"],
    ["İstanbul Çayı & Kahvesi", "istanbul-cayi-kahvesi"],
    ["  Ğüşiöç  ", "gusioc"],
    ["2024", ""],
  ])("makes %s into %s", (input, slug) => {
    expect(toSlug(input)).toBe(slug)
  })

  it("cuts at a word boundary under 80 characters", () => {
    const slug = toSlug("uzun ".repeat(30))
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith("-")).toBe(false)
    expect(isValidSlug(slug)).toBe(true)
  })
})
