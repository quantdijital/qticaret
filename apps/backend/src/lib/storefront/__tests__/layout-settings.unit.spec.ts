import { layoutDocument, readStoredLayout } from "../layout"
import {
  UNSET_SETTINGS,
  layoutSettings,
  lowStockOf,
  shownSettings,
  storedSettings,
  withLegacy,
} from "../layout-settings"
import { themeSection } from "../../../modules/platform-settings/sections/theme"

const GRAFIT = themeSection.defaults
const SHOWN_GRAFIT = Object.fromEntries(
  Object.entries(GRAFIT).filter(([key]) => key !== "settings_version")
)

const LEGACY = {
  trust_badges: [
    { icon: "truck" as const, title: "{ücretsiz_kargo_eşiği} üzeri kargo bedava", text: null },
    { icon: "refresh" as const, title: "14 gün iade", text: "Koşulsuz" },
  ],
  color_swatches: [{ label: "Siyah", hex: "#111111" }],
  low_stock_threshold: 3,
  primary_color: null,
  theme: GRAFIT,
}
const parses = (settings: unknown) => layoutSettings.safeParse(settings).success

describe("the theme's shared settings in the design (adr/0049 Ek 2026-11-06)", () => {
  it("reads a document from before them with every part unset", () => {
    expect(layoutDocument.parse({}).settings).toEqual(UNSET_SETTINGS)
    expect(layoutSettings.parse({})).toEqual(UNSET_SETTINGS)
  })

  it("keeps written parts: badges, colour names lower-cased, the 'Az kaldı' line", () => {
    const read = layoutSettings.parse({
      trust_badges: [{ icon: "shield", title: "Güvenli ödeme {mağaza_adı}" }],
      color_swatches: [{ label: "Lacivert", hex: "#1F2A44" }],
      low_stock: { enabled: true, threshold: 5 },
    })
    expect(read).toEqual({
      trust_badges: [{ icon: "shield", title: "Güvenli ödeme {mağaza_adı}", text: null }],
      color_swatches: [{ label: "Lacivert", hex: "#1f2a44" }],
      low_stock: { enabled: true, threshold: 5 },
      theme: null,
      menus: null,
      preset: null,
      design: null,
    })
    // Written empty is not unset: the shop chose none
    expect(layoutSettings.parse({ trust_badges: [], color_swatches: [] })).toMatchObject({
      trust_badges: [],
      color_swatches: [],
    })
  })

  it("refuses what the old fields refused, and a threshold outside 1–1000", () => {
    const badge = { icon: "truck", title: "Hızlı kargo", text: null }
    for (const wrong of [
      { trust_badges: Array.from({ length: 5 }, () => badge) },
      { trust_badges: [{ ...badge, icon: "rocket" }] },
      { trust_badges: [{ ...badge, title: "" }] },
      { trust_badges: [{ ...badge, title: "x".repeat(41) }] },
      { trust_badges: [{ ...badge, text: "x".repeat(81) }] },
      { trust_badges: [{ ...badge, title: "{bilinmeyen}" }] },
      { color_swatches: [{ label: "Siyah", hex: "black" }] },
      { color_swatches: [{ label: "x".repeat(41), hex: "#000000" }] },
      {
        color_swatches: [
          { label: "Işık", hex: "#ffffff" },
          { label: "IŞIK", hex: "#fefefe" },
        ],
      },
      {
        color_swatches: Array.from({ length: 101 }, (_, i) => ({
          label: `R${String(i)}`,
          hex: "#000000",
        })),
      },
      { low_stock: { enabled: true, threshold: 0 } },
      { low_stock: { enabled: true, threshold: 1001 } },
      { low_stock: { enabled: true, threshold: 2.5 } },
      { low_stock: { enabled: "evet", threshold: 3 } },
      { swatches: [] },
    ]) {
      expect(parses(wrong)).toBe(false)
    }
  })

  it("fills each unset part from the old field, and leaves a written one alone", () => {
    expect(withLegacy({ ...UNSET_SETTINGS }, LEGACY)).toEqual({
      trust_badges: LEGACY.trust_badges,
      color_swatches: LEGACY.color_swatches,
      low_stock: { enabled: true, threshold: 3 },
      theme: GRAFIT,
      menus: null,
      preset: null,
      design: null,
    })
    const own = {
      trust_badges: [],
      color_swatches: [{ label: "Beyaz", hex: "#ffffff" }],
      low_stock: { enabled: false, threshold: 7 },
      theme: { ...GRAFIT, radius: "sharp" as const },
      menus: null,
      preset: { pack: "general", code: "grafit", version: 1 },
      design: null,
    }
    expect(withLegacy(own, LEGACY)).toEqual(own)
    expect(withLegacy({ ...UNSET_SETTINGS, trust_badges: [] }, LEGACY).trust_badges).toEqual([])
  })

  it("reads the old threshold's 0 as off, and caps a larger one at the limit", () => {
    expect(lowStockOf(0)).toEqual({ enabled: false, threshold: 3 })
    expect(lowStockOf(12)).toEqual({ enabled: true, threshold: 12 })
    expect(lowStockOf(5000)).toEqual({ enabled: true, threshold: 1000 })
  })

  it("applies the settings as the storefront and the cards read them", () => {
    expect(shownSettings({ ...UNSET_SETTINGS }, LEGACY)).toEqual({
      trust_badges: LEGACY.trust_badges,
      color_swatches: LEGACY.color_swatches,
      low_stock_threshold: 3,
      theme: SHOWN_GRAFIT,
    })
    expect(
      shownSettings({ ...UNSET_SETTINGS, low_stock: { enabled: false, threshold: 9 } }, LEGACY)
        .low_stock_threshold
    ).toBe(0)
    expect(
      shownSettings({ ...UNSET_SETTINGS, low_stock: { enabled: true, threshold: 9 } }, LEGACY)
        .low_stock_threshold
    ).toBe(9)
  })

  it("reads a stored document's settings alone; none or an unreadable one is unset", () => {
    expect(storedSettings(null)).toEqual(UNSET_SETTINGS)
    expect(storedSettings({ home: [] })).toEqual(UNSET_SETTINGS)
    expect(storedSettings({ settings: { low_stock: { enabled: "x" } } })).toEqual(UNSET_SETTINGS)
    expect(storedSettings({ settings: { color_swatches: [] } })).toEqual({
      ...UNSET_SETTINGS,
      color_swatches: [],
    })
    // Part by part (adr/0063 §3): one part the schema no longer reads leaves the others standing
    expect(
      storedSettings({
        settings: { low_stock: { enabled: "x" }, color_swatches: [], theme: { radius: "oval" } },
      })
    ).toEqual({ ...UNSET_SETTINGS, color_swatches: [] })
    // The applied preset (adr/0063 §2): kept as written, unset when it no longer reads
    const preset = { pack: "general", code: "grafit", version: 1 }
    expect(storedSettings({ settings: { preset } }).preset).toEqual(preset)
    expect(storedSettings({ settings: { preset: { pack: "general" } } }).preset).toBeNull()
    // An empty menu set is none: the publication leaves the shop's menus alone
    expect(storedSettings({ settings: { theme: GRAFIT, menus: [] } })).toEqual({
      ...UNSET_SETTINGS,
      theme: GRAFIT,
      menus: null,
    })

    // A theme written without the settings' version (a script, a preset) reads with today's
    // meaning: the design's theme has no time before the version, so nothing turns to Grafit
    const unversioned = Object.fromEntries(
      Object.entries(GRAFIT).filter(([key]) => key !== "settings_version")
    )
    const written = {
      ...unversioned,
      colors: { primary: "#0b5c99", accent: null, background: "warm" },
      typography: { heading: "fraunces", body: "inter" },
      radius: "round",
      product_card: { ratio: "4:5", show_brand: false, show_rating: true },
    }
    // A card written before its variant and E5 fields reads as today's card (adr/0049 Ek 2026-11-14 §3.3)
    const read = {
      ...written,
      settings_version: GRAFIT.settings_version,
      product_card: { ...GRAFIT.product_card, ...written.product_card },
    }
    expect(storedSettings({ settings: { theme: written } }).theme).toEqual(read)
    // A save still has to carry it
    expect(parses({ theme: written })).toBe(false)
    // So does a whole stored document (draft, live, revision): it neither drops nor fails the read
    expect(() => layoutDocument.parse({ settings: { theme: written } })).toThrow()
    expect(readStoredLayout({ settings: { theme: written } }).settings.theme).toEqual(read)
    expect(readStoredLayout({ home: [] }).settings.theme).toBeNull()
  })

  it("reads a stored document's settings part by part, as the storefront's frame does", () => {
    // A theme today's schema refuses (a rule added since): unset, not a failed read
    const stored = {
      home: [],
      settings: {
        theme: { ...GRAFIT, colors: { ...GRAFIT.colors, primary: "#fde68a" } },
        low_stock: { enabled: true, threshold: 3 },
      },
    }
    const read = readStoredLayout(stored)
    expect(read.settings).toEqual(storedSettings(stored))
    expect(read.settings.theme).toBeNull()
    expect(read.settings.low_stock).toEqual({ enabled: true, threshold: 3 })
  })
})

describe("the applied saved look's label in the design (adr/0064 Ek 2026-11-17 §2)", () => {
  const digest = "a".repeat(64)

  it("keeps a saved look's id and digest, or a ready-made look's null id", () => {
    const saved = { id: "sfd_01JABCDEF", digest }
    expect(layoutSettings.parse({ design: saved }).design).toEqual(saved)
    expect(layoutSettings.parse({ design: { id: null, digest } }).design).toEqual({
      id: null,
      digest,
    })
    expect(layoutSettings.parse({}).design).toBeNull()
  })

  it("refuses a label that is not one: a foreign id, a short digest, an extra key", () => {
    for (const wrong of [
      { id: "prod_01JABCDEF", digest },
      { id: "sfd_", digest },
      { id: "sfd_01J;drop", digest },
      { id: null, digest: "A".repeat(64) },
      { id: null, digest: "a".repeat(63) },
      { id: null, digest, name: "Kış" },
    ]) {
      expect(parses({ design: wrong })).toBe(false)
    }
  })

  it("reads a stored label alone, an unreadable one unset, and fills nothing from the old fields", () => {
    const label = { id: "sfd_01JABCDEF", digest }
    expect(storedSettings({ settings: { design: label } }).design).toEqual(label)
    expect(storedSettings({ settings: { design: { id: 7 }, color_swatches: [] } })).toEqual({
      ...UNSET_SETTINGS,
      color_swatches: [],
    })
    expect(withLegacy({ ...UNSET_SETTINGS, design: label }, LEGACY).design).toEqual(label)
    expect(withLegacy({ ...UNSET_SETTINGS }, LEGACY).design).toBeNull()
  })
})

describe("the theme's settings and a menu set in the design (adr/0063 §3)", () => {
  const menu = (location: string, title = "Menü") => ({
    title,
    location,
    items: [{ link: { kind: "system", target: "shop", label: null } }],
  })

  it("takes the theme section's schema, its contrast rule included", () => {
    expect(layoutSettings.parse({ theme: GRAFIT }).theme).toEqual(GRAFIT)
    for (const wrong of [
      { ...GRAFIT, colors: { ...GRAFIT.colors, primary: "#fde68a" } },
      { ...GRAFIT, radius: "oval" },
      { ...GRAFIT, css: "body{display:none}" },
      { ...GRAFIT, settings_version: 1 },
      { ...GRAFIT, typography: { heading: "https://fonts.example/x.woff2", body: "inter" } },
    ]) {
      expect(parses({ theme: wrong })).toBe(false)
    }
  })

  it("takes a menu set the Menüler screen would take: one header menu, one top row, the footer columns", () => {
    const set = layoutSettings.parse({
      menus: [menu("main"), menu("top"), menu("footer", "Kurumsal"), menu("footer", "Yardım")],
    }).menus
    expect(set).toHaveLength(4)
    expect(set?.[0]).toMatchObject({ rank: 0, items: [{ children: [] }] })
    // An empty set would delete every menu at the publication: "leave them alone" is null
    expect(parses({ menus: [] })).toBe(false)
    expect(parses({ menus: null })).toBe(true)
    expect(parses({ menus: [menu("main"), menu("main")] })).toBe(false)
    expect(parses({ menus: [menu("top"), menu("top")] })).toBe(false)
    expect(parses({ menus: Array.from({ length: 11 }, () => menu("footer")) })).toBe(false)
    expect(
      parses({
        menus: [
          { ...menu("main"), items: [{ link: { kind: "url", url: "javascript:x", label: "x" } }] },
        ],
      })
    ).toBe(false)
  })

  it("opens an unset theme as the theme section holds it, the old main colour in while it reads", () => {
    const withOld = (primary_color: string | null) =>
      withLegacy({ ...UNSET_SETTINGS }, { ...LEGACY, primary_color }).theme
    expect(withOld("#0b5c99")?.colors.primary).toBe("#0b5c99")
    // Pale on the steel page: the theme's own ink rather than a draft that cannot be saved
    expect(withOld("#fde68a")?.colors.primary).toBeNull()
    const own = { ...GRAFIT, colors: { ...GRAFIT.colors, primary: "#1e3a8a" } }
    expect(
      withLegacy({ ...UNSET_SETTINGS }, { ...LEGACY, theme: own, primary_color: "#0b5c99" }).theme
    ).toEqual(own)
  })

  it("applies the design's theme as written, else the section's with the old colour as always", () => {
    const written = {
      ...GRAFIT,
      colors: { ...GRAFIT.colors, primary: null },
      radius: "round" as const,
    }
    expect(
      shownSettings({ ...UNSET_SETTINGS, theme: written }, { ...LEGACY, primary_color: "#fde68a" })
        .theme
    ).toEqual({ ...SHOWN_GRAFIT, radius: "round" })
    expect(
      shownSettings({ ...UNSET_SETTINGS }, { ...LEGACY, primary_color: "#fde68a" }).theme.colors
        .primary
    ).toBe("#fde68a")
  })
})
