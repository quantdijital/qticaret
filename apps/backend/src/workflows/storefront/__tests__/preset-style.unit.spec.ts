import { storefrontPreset } from "@qticaret/sector-packs"
import { AdminPostStorefrontPresetApply } from "../../../api/admin/storefront-presets/validators"
import { ValidationError } from "../../../lib/errors"
import { layoutDocument } from "../../../lib/storefront/layout"
import { presetTheme } from "../../../lib/storefront/presets/document"
import { withPresetStyle } from "../preset-style"

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }
const PRESET = { pack: "travel", code: "vadi", version: 3 }

const draft = () =>
  layoutDocument.parse({
    header: [{ id: "duyurular", type: "announcement_bar", ...SCHEDULE, lines: ["Kargo bedava"] }],
    home: [{ id: "yardimkutusu", type: "help", ...SCHEDULE, title: "Bize yazın", text: null }],
    footer: [],
    product: [],
    category: [],
    pages: [],
    settings: { preset: PRESET, design: { id: null, digest: "a".repeat(64) } },
  })

const tezgah = () => {
  const preset = storefrontPreset("cutlery", "tezgah")
  if (!preset) {
    throw new Error("no tezgah preset")
  }
  return presetTheme(preset.theme_settings)
}

describe("another sector's look, its style alone (owner, 2026-11-28)", () => {
  it("puts the look's theme in the draft and keeps every section, page and label", () => {
    const before = draft()
    const theme = tezgah()
    const after = withPresetStyle(before, theme)
    expect(after.settings.theme).toEqual(theme)
    expect(after.header).toEqual(before.header)
    expect(after.home).toEqual(before.home)
    expect(after.pages).toEqual(before.pages)
    expect(after.settings.preset).toEqual(PRESET)
    expect(after.settings.design).toEqual(before.settings.design)
    expect(after.settings.menus).toEqual(before.settings.menus)
    // The draft given is not changed in place
    expect(before.settings.theme).not.toEqual(theme)
  })

  it("refuses a theme the editor's schema does not take, writing nothing", () => {
    expect(() =>
      withPresetStyle(draft(), { colors: "red" } as unknown as ReturnType<typeof tezgah>)
    ).toThrow(ValidationError)
  })
})

describe("the apply's scope (owner, 2026-11-28)", () => {
  it("is the whole look unless asked otherwise, so the calls before it apply as they did", () => {
    expect(AdminPostStorefrontPresetApply.parse({})).toEqual({ demo: false, scope: "full" })
    expect(AdminPostStorefrontPresetApply.parse({ scope: "style" }).scope).toBe("style")
  })

  it("refuses a scope no one writes, and anything beside it", () => {
    expect(AdminPostStorefrontPresetApply.safeParse({ scope: "sections" }).success).toBe(false)
    expect(AdminPostStorefrontPresetApply.safeParse({ scope: null }).success).toBe(false)
    expect(AdminPostStorefrontPresetApply.safeParse({ scope: "style", x: 1 }).success).toBe(false)
  })
})
