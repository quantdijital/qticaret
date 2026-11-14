import { describe, expect, it } from "vitest"
import { SECTION_VARIANTS } from "@qticaret/types"
import type { TrustBadgesSection } from "@/features/storefront/api/layout"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { newBodySection, newHomeSection } from "./sections"
import { VARIANT_FIELDS, offersVariants, switchVariant } from "./variants"

const strip = newHomeSection("trust_badges", "guvenserit") as TrustBadgesSection

/** adr/0049 Ek 2026-11-14 §2: a section drawn more than one way. */
describe("section variants in the editor", () => {
  it("adds a section in its type's default variant", () => {
    expect(strip.variant).toBe("strip")
    expect(newBodySection("category", "trust_badges", "kategoriguv")).toMatchObject({
      variant: "strip",
      placement: "bottom",
    })
  })

  it("offers the choice only for a type drawn more than one way", () => {
    expect(offersVariants(strip)).toBe(true)
    expect(offersVariants(newHomeSection("faq", "sss000001"))).toBe(false)
  })

  it("switches the variant keeping what is common, as a new section", () => {
    const scheduled = { ...strip, visible: false, starts_at: "2026-12-01T00:00:00+03:00" }

    const lined = switchVariant(scheduled, "lined")

    expect(lined).toEqual({ ...scheduled, variant: "lined" })
    expect(lined).not.toBe(scheduled)
    expect(switchVariant(lined, "strip")).toEqual(scheduled)
  })

  it("names every variant in both languages and starts its own fields", () => {
    for (const [type, variants] of Object.entries(SECTION_VARIANTS)) {
      for (const variant of variants) {
        const key = (dict: typeof tr) =>
          (dict.storefront.editor.variants as unknown as Record<string, Record<string, string>>)[
            type
          ]?.[variant]
        expect(key(tr)).toBeTruthy()
        expect(key(en)).toBeTruthy()
        expect(Object.keys(VARIANT_FIELDS[type as keyof typeof VARIANT_FIELDS])).toContain(variant)
      }
    }
  })
})
