import { describe, expect, it } from "vitest"
import { applyPreset } from "@/features/products/layout/presets"
import { DEFAULT_LAYOUT } from "@/features/products/layout/parts"
import { readiness } from "./readiness"
import { defaultWizardValues, stepsFor } from "./schema"
import { ALL_SHOWN, wizardShown } from "./wizard-layout"

describe("the wizard as the shop laid out its product page", () => {
  it("asks everything with the default layout", () => {
    expect(wizardShown(DEFAULT_LAYOUT)).toEqual(ALL_SHOWN)
    expect(stepsFor("physical", ALL_SHOWN)).toEqual([
      "basics",
      "media",
      "pricing",
      "shipping",
      "review",
    ])
  })

  it("skips the steps and fields of the parts Basit hides; name and prices are always asked", () => {
    const shown = wizardShown(applyPreset("basic", DEFAULT_LAYOUT))
    expect(shown).toEqual({
      media: true,
      shipping: false,
      description: true,
      shortDescription: false,
      organize: false,
      catalog: false,
      attributes: false,
    })
    expect(stepsFor("physical", shown)).toEqual(["basics", "media", "pricing", "review"])
    expect(stepsFor("physical", { media: false, shipping: true })).toEqual([
      "basics",
      "pricing",
      "shipping",
      "review",
    ])
    // A digital product never had a parcel step
    expect(stepsFor("digital", ALL_SHOWN)).not.toContain("shipping")
  })

  it("leaves out the advice on a part not asked, keeps what publishing waits for", () => {
    const values = defaultWizardValues()
    const keys = (shown = ALL_SHOWN) => readiness(values, shown).map((item) => item.key)
    expect(keys()).toEqual(["title", "price", "measures", "images", "description", "category"])
    expect(
      keys({ ...ALL_SHOWN, media: false, shipping: false, description: false, organize: false })
    ).toEqual(["title", "price"])
  })
})
