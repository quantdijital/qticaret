import { describe, expect, it } from "vitest"
import { SECTION_LOOK, SECTION_LOOK_FIELDS } from "@qticaret/types"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { lookCount, lookFieldsFor, lookStep, lookStepsFor, withLookStep } from "./look"
import { newHomeSection } from "./sections"

const faq = newHomeSection("faq", "sss000001")

/** adr/0049 Ek 2026-11-14 §6: a body section's look in the editor. */
describe("a section's look in the editor", () => {
  it("adds a section without a look: the theme's own drawing", () => {
    expect(faq).not.toHaveProperty("look")
    expect(lookStep(faq, "ground")).toBeNull()
    expect(lookCount(faq)).toBe(0)
  })

  it("sets one step at a time, the others left to the theme", () => {
    const set = withLookStep(withLookStep(faq, "ground", "well"), "space_outer", "none")

    expect(set.look).toEqual({
      space_outer: "none",
      space_below: null,
      space_inner: null,
      ground: "well",
      align: null,
      width: null,
    })
    expect(lookCount(set)).toBe(2)
    expect(faq).not.toHaveProperty("look")
  })

  it("drops the look once every step is back to the theme's, as the section was", () => {
    const set = withLookStep(faq, "width", "narrow")
    const back = withLookStep(set, "width", null)

    expect(back).toEqual(faq)
    expect(back).not.toHaveProperty("look")
  })

  it("offers no alignment where the words sit on a picture or there are none", () => {
    expect(lookFieldsFor("hero")).not.toContain("align")
    expect(lookFieldsFor("trust_badges")).not.toContain("align")
    expect(lookFieldsFor("products")).toEqual(SECTION_LOOK_FIELDS)
  })

  it("does not offer the shop's colour as the ground of long text (adr/0062 §6)", () => {
    expect(lookStepsFor("rich_text", "ground")).toEqual(["page", "well", "stage"])
    expect(lookStepsFor("faq", "ground")).not.toContain("primary")
    expect(lookStepsFor("products", "ground")).toEqual(SECTION_LOOK.ground)
  })

  it("names every field, its term and its steps in Turkish and English", () => {
    for (const locale of [tr, en]) {
      const look = locale.storefront.editor.look as unknown as Record<
        string,
        Record<string, string>
      >
      for (const field of SECTION_LOOK_FIELDS) {
        expect(look[field]?.["label"]).toBeTruthy()
        expect(look[field]?.["term"]).toBeTruthy()
        for (const step of SECTION_LOOK[field]) {
          expect(look[field]?.[step]).toBeTruthy()
        }
      }
    }
  })
})
