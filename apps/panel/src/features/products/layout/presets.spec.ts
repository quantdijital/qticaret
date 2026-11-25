import { describe, expect, it } from "vitest"
import { DEFAULT_LAYOUT, FOLDED_PARTS, isLocked, layoutOf } from "./parts"
import type { ProductLayout } from "./parts"
import { applyPreset, presetOf } from "./presets"

describe("ready layouts of the product page", () => {
  it("Basit shows the main work and the advisor, and keeps the parts a dated product needs", () => {
    const basic = applyPreset("basic", DEFAULT_LAYOUT)
    const shown = [...basic.main, ...basic.side].filter((key) => !basic.hidden.includes(key))
    expect(shown).toEqual([
      "general",
      "variants",
      "media",
      "description",
      "departures",
      "program",
      "advisor",
    ])
    expect(basic.hidden.some(isLocked)).toBe(false)
    expect(basic.open).toEqual([])
  })

  it("Standart is the default layout, Gelişmiş shows everything with the folded parts open", () => {
    expect(applyPreset("standard", DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT)
    const advanced = applyPreset("advanced", { ...DEFAULT_LAYOUT, hidden: ["faq", "seo"] })
    expect(advanced.hidden).toEqual([])
    expect(advanced.open).toEqual([...FOLDED_PARTS])
  })

  it("keeps the columns' order as arranged", () => {
    const arranged: ProductLayout = {
      ...DEFAULT_LAYOUT,
      main: [...DEFAULT_LAYOUT.main].reverse(),
    }
    for (const preset of ["basic", "standard", "advanced"] as const) {
      expect(applyPreset(preset, arranged).main).toEqual(arranged.main)
    }
  })

  it("tells which preset a layout is, none when arranged by hand", () => {
    expect(presetOf(DEFAULT_LAYOUT)).toBe("standard")
    expect(presetOf(applyPreset("basic", DEFAULT_LAYOUT))).toBe("basic")
    expect(presetOf(applyPreset("advanced", DEFAULT_LAYOUT))).toBe("advanced")
    expect(presetOf({ ...DEFAULT_LAYOUT, hidden: ["faq"] })).toBeNull()
  })

  it("survives being saved and read back", () => {
    const advanced = applyPreset("advanced", DEFAULT_LAYOUT)
    expect(layoutOf(advanced)).toEqual(advanced)
    // A key that does not fold, or is unknown, never starts open
    expect(layoutOf({ ...advanced, open: ["general", "nope", "seo"] }).open).toEqual(["seo"])
  })
})
