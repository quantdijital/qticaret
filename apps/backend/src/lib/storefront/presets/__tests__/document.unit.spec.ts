import { storefrontPreset } from "@qticaret/sector-packs"
import { isValidationError } from "../../../errors"
import { presetDocument, presetTheme } from "../document"
import { resolvePreset } from "../resolve"
import type { PresetLookups } from "../resolve"

const grafit = storefrontPreset("general", "grafit")
if (!grafit) {
  throw new Error("no grafit preset")
}

const lookups: PresetLookups = {
  records: new Map(),
  links: new Map([["/magaza", { kind: "system" as const, target: "shop" as const }]]),
  images: new Map(),
}

const KEPT = {
  trust_badges: [{ icon: "truck" as const, title: "Hızlı kargo", text: null }],
  color_swatches: null,
  low_stock: { enabled: true, threshold: 5 },
}
const APPLIED = { pack: "general", code: "grafit", version: grafit.version }

const refusal = (run: () => unknown): { message: string; field: string | undefined } => {
  try {
    run()
  } catch (error) {
    if (isValidationError(error)) {
      return { message: error.safeMessage, field: error.field }
    }
    throw error
  }
  throw new Error("not refused")
}

describe("the draft a preset makes (adr/0063 §4)", () => {
  it("writes grafit's sections, theme and name, keeping the shop's badges and Az kaldı", () => {
    const resolved = resolvePreset(grafit.layout, grafit.menus, lookups)
    const doc = presetDocument(resolved, presetTheme(grafit.theme_settings), APPLIED, KEPT)
    expect(doc.home.map((section) => section.type)).toEqual([
      "hero",
      "categories",
      "products",
      "help",
      "posts",
    ])
    expect(doc.home[2]).toEqual(
      expect.objectContaining({ more: { kind: "system", target: "shop", label: null } })
    )
    expect(doc.footer.map((section) => section.id)).toEqual(["ebultenkutusu"])
    const { theme, ...rest } = doc.settings
    expect(rest).toEqual({ ...KEPT, menus: null, preset: APPLIED })
    expect(theme).toEqual(presetTheme(grafit.theme_settings))
    expect(theme?.buttons).toBe("pill")
    expect(resolved.skipped).toEqual([])
  })

  it("refuses a theme the theme section does not take, naming the field", () => {
    expect(
      refusal(() =>
        presetTheme({ ...grafit.theme_settings, typography: { heading: "comic", body: "manrope" } })
      )
    ).toEqual({ message: "storefront_preset.theme_invalid", field: "theme.typography.heading" })
    expect(refusal(() => presetTheme({ ...grafit.theme_settings, theme: "baska" })).message).toBe(
      "storefront_preset.theme_invalid"
    )
  })

  it("refuses a design the editor's schema does not take", () => {
    const theme = presetTheme(grafit.theme_settings)
    const groups = { header: [], home: [], footer: [], product: [], category: [] }
    const unknownType = {
      groups: { ...groups, home: [{ id: "garipbolum", type: "marquee", visible: true }] },
      menus: null,
    }
    expect(refusal(() => presetDocument(unknownType, theme, APPLIED, KEPT)).message).toBe(
      "storefront_preset.layout_invalid"
    )
    // An empty menu set would delete every menu of the shop when published
    expect(refusal(() => presetDocument({ groups, menus: [] }, theme, APPLIED, KEPT)).message).toBe(
      "storefront_preset.layout_invalid"
    )
  })

  it("takes a section's variant, the default where it names none (adr/0049 Ek 2026-11-14)", () => {
    const theme = presetTheme(grafit.theme_settings)
    const groups = { header: [], home: [], footer: [], product: [], category: [] }
    const strip = { id: "guvenserit", type: "trust_badges" }
    const lined = { ...strip, id: "guvencizgi", variant: "lined" }

    const doc = presetDocument(
      { groups: { ...groups, home: [strip, lined] }, menus: null },
      theme,
      APPLIED,
      KEPT
    )
    const offList = { groups: { ...groups, home: [{ ...strip, variant: "bento" }] }, menus: null }

    expect(doc.home).toMatchObject([{ variant: "strip" }, { variant: "lined" }])
    expect(refusal(() => presetDocument(offList, theme, APPLIED, KEPT)).message).toBe(
      "storefront_preset.layout_invalid"
    )
  })
})
