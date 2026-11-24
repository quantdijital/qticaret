import path from "node:path"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument, readStoredLayout } from "../layout"
import { HAND_NOTE_MAX } from "../sections/hand-note"
import { ACCENT_FONTS, themeSection } from "../../../modules/platform-settings/sections/theme"
import { mergePatch } from "../../../modules/platform-settings/sections/define"
import { presetTheme } from "../presets/document"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/hand-note.ts"
)

const WIDE = { url: "http://localhost:9000/static/vadi.webp", alt: "Vadi" }
const SHOP = { kind: "system", target: "shop", label: null } as const
const full = (more: Record<string, unknown> = {}) => ({
  id: "kapak00001",
  type: "hero",
  variant: "full_image",
  ...more,
})
const split = (more: Record<string, unknown> = {}) => ({
  id: "kampanya1",
  type: "banner",
  variant: "split",
  slides: [{ image: WIDE, heading: "Sıradaki maceranız", link: SHOP }],
  ...more,
})
const first = (section: Record<string, unknown>) =>
  layoutDocument.parse({ home: [section] }).home[0]
const issues = (section: Record<string, unknown>) =>
  layoutDocument.safeParse({ home: [section] }).error?.issues.map((issue) => issue.message) ?? []
const at = { values: {}, images: new Map(), links: new Map() } as unknown as HydrateContext

describe("a section's hand note (hand-note.ts)", () => {
  it("is the contract's length", () => {
    const contract = jest.requireActual<{ HAND_NOTE_MAX: unknown; ACCENT_FONTS: unknown }>(
      CONTRACT_FILE
    )
    expect(HAND_NOTE_MAX).toBe(contract.HAND_NOTE_MAX)
    expect(HAND_NOTE_MAX).toBe(60)
    expect(ACCENT_FONTS).toEqual(contract.ACCENT_FONTS)
  })

  it.each([
    ["the full image opening", full],
    ["the split band", split],
  ])("keeps %s's note trimmed, and none as null", (_, section) => {
    expect(first(section({ note: "  Sizi bekliyoruz!  " }))).toMatchObject({
      note: "Sizi bekliyoruz!",
    })
    expect(first(section({ note: "Çığ gibi şölen: İğne, ödül, ünlü" }))).toMatchObject({
      note: "Çığ gibi şölen: İğne, ödül, ünlü",
    })
    expect(first(section())).toMatchObject({ note: null })
    expect(first(section({ note: null }))).toMatchObject({ note: null })
  })

  it.each([
    ["the full image opening", full],
    ["the split band", split],
  ])("refuses %s's note past its length, empty, with a control character or not text", (_, s) => {
    expect(issues(s({ note: "a".repeat(HAND_NOTE_MAX) }))).toEqual([])
    expect(issues(s({ note: "a".repeat(HAND_NOTE_MAX + 1) }))).toHaveLength(1)
    expect(issues(s({ note: "   " }))).toHaveLength(1)
    expect(issues(s({ note: "Bekliyoruz\u0000" }))).toEqual(["storefront_layout.text_invalid"])
    expect(issues(s({ note: 42 }))).toHaveLength(1)
  })

  it("is not a field of today's opening, today's band or the catalogue opening", () => {
    expect(issues({ id: "kapak00002", type: "hero", note: "Merhaba" })).toHaveLength(1)
    expect(issues(split({ variant: "standard", note: "Merhaba" }))).toHaveLength(1)
  })

  it("reads a section stored before it as it was, with no note", () => {
    const stored = readStoredLayout({ home: [full({ heading: "Yeni" }), split()] })
    expect(stored.home[0]).toMatchObject({ variant: "full_image", note: null })
    expect(stored.home[1]).toMatchObject({ variant: "split", note: null })
  })

  it("prints the note as written: no shop token is filled in it", async () => {
    const hero = first(full({ note: "Sizi bekliyoruz!" }))
    const band = first(split({ note: "{shop_name} sizi bekliyor" }))
    if (!hero || !band) {
      throw new Error("no sections")
    }
    expect(await hydrateSection(hero, at)).toMatchObject({ note: "Sizi bekliyoruz!" })
    expect(await hydrateSection(band, at)).toMatchObject({ note: "{shop_name} sizi bekliyor" })
    // Today's band prints none of the split's fields
    const standard = first(split({ variant: "standard" }))
    if (!standard) {
      throw new Error("no band")
    }
    expect(await hydrateSection(standard, at)).not.toHaveProperty("note")
  })
})

describe("the theme's accent face (typography.accent)", () => {
  const { full: schema, defaults } = themeSection
  const saved = (typography: Record<string, unknown>) =>
    schema.safeParse(
      mergePatch(defaults, { typography: { ...defaults.typography, ...typography } })
    )

  it("takes every face on the list, none the default", () => {
    for (const accent of ACCENT_FONTS) {
      expect(saved({ accent }).data?.typography.accent).toBe(accent)
    }
    expect(ACCENT_FONTS[0]).toBe("none")
  })

  it("refuses a face off the list or an address", () => {
    expect(saved({ accent: "comic-sans" }).success).toBe(false)
    expect(saved({ accent: "https://fonts.example/x.woff2" }).success).toBe(false)
    expect(saved({ accent: null }).success).toBe(false)
  })

  it("leaves a row, a design or a preset written before it valid, with no face", () => {
    const old = saved({})
    expect(old.success).toBe(true)
    expect(old.data?.typography).toEqual({ heading: "manrope", body: "manrope" })
    expect(defaults.typography).not.toHaveProperty("accent")
    const preset = { ...defaults, typography: { heading: "inter", body: "inter" } }
    expect(presetTheme(preset).typography).toEqual({ heading: "inter", body: "inter" })
    // A preset may name a face too (none does in this change)
    const accented = { ...preset, typography: { ...preset.typography, accent: "caveat" } }
    expect(presetTheme(accented).typography.accent).toBe("caveat")
  })
})
