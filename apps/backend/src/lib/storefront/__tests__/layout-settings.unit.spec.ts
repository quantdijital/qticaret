import { layoutDocument } from "../layout"
import {
  UNSET_SETTINGS,
  layoutSettings,
  lowStockOf,
  shownSettings,
  storedSettings,
  withLegacy,
} from "../layout-settings"

const LEGACY = {
  trust_badges: [
    { icon: "truck" as const, title: "{ücretsiz_kargo_eşiği} üzeri kargo bedava", text: null },
    { icon: "refresh" as const, title: "14 gün iade", text: "Koşulsuz" },
  ],
  color_swatches: [{ label: "Siyah", hex: "#111111" }],
  low_stock_threshold: 3,
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
    })
    const own = {
      trust_badges: [],
      color_swatches: [{ label: "Beyaz", hex: "#ffffff" }],
      low_stock: { enabled: false, threshold: 7 },
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
  })
})
