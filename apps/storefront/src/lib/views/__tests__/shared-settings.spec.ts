import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreLayoutSettings, StoreMenu, StoreThemeSettings } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { menusOf, sharedSettingsOf, themeSourceOf } from "../shared-settings"
import { DEFAULT_THEME } from "../theme"
import type * as layoutModule from "../layout"

type LayoutModule = typeof layoutModule

// The badges and colour names as a backend before the move gives them, in the frame
const FRAME = {
  trust_badges: [{ icon: "truck" as const, title: "Eski rozet", text: null }],
  color_swatches: [{ label: "Siyah", hex: "#111111" }],
}

const DESIGN: StoreLayoutSettings = {
  trust_badges: [{ icon: "shield", title: "Güvenli ödeme", text: "256 bit" }],
  color_swatches: [{ label: "Lacivert", hex: "#1f2a44" }],
}

const shared = vi.hoisted(() => ({ current: vi.fn() }))
vi.mock("@/lib/store-api/requests", () => ({
  listProducts: vi.fn(),
  pathsOf: vi.fn(),
  priceDisplays: vi.fn(),
  legalIdentity: vi.fn(),
  siteSeo: vi.fn(),
  storefrontSettings: vi.fn(() => Promise.resolve({ storefront: FRAME })),
}))
vi.mock("@/lib/store-api/extras", () => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
}))
vi.mock("../layout", async (importOriginal) => ({
  ...(await importOriginal<LayoutModule>()),
  currentShared: shared.current,
}))

const { sectionViews } = await import("../sections")

describe("the theme's shared settings (adr/0049 Ek 2026-11-06)", () => {
  beforeEach(() => {
    shared.current.mockReset()
  })

  it("reads the design's badges and colour names", () => {
    expect(sharedSettingsOf({ settings: DESIGN }, FRAME)).toEqual(DESIGN)
  })

  it("falls back to the frame's copy from a backend before them", () => {
    expect(sharedSettingsOf({}, FRAME)).toEqual(FRAME)
  })

  it("keeps the design's empty choice: no badges is no badges", () => {
    const none = { trust_badges: [], color_swatches: [] }
    expect(sharedSettingsOf({ settings: none }, FRAME)).toEqual(none)
  })

  it("draws a trust strip section from the design's badges, and none without badges", async () => {
    shared.current.mockResolvedValueOnce(DESIGN)
    const [strip] = await sectionViews([{ id: "guven1", type: "trust_badges" }], t)
    // No variant from an older backend: the default, today's strip (adr/0049 Ek 2026-11-14 §2)
    expect(strip).toEqual({
      id: "guven1",
      type: "trust_badges",
      variant: "strip",
      badges: DESIGN.trust_badges,
    })

    shared.current.mockResolvedValueOnce({ trust_badges: [], color_swatches: [] })
    expect(await sectionViews([{ id: "guven1", type: "trust_badges" }], t)).toEqual([])
  })

  it("carries the strip's variant to the theme, one the contract does not know as the default", async () => {
    shared.current.mockResolvedValue(DESIGN)
    const [lined] = await sectionViews(
      [{ id: "guven1", type: "trust_badges", variant: "lined" }],
      t
    )
    const newer = { id: "guven2", type: "trust_badges", variant: "bento" } as unknown as Parameters<
      typeof sectionViews
    >[0][number]
    const [fallback] = await sectionViews([newer], t)
    shared.current.mockReset()

    expect(lined).toMatchObject({ type: "trust_badges", variant: "lined" })
    expect(fallback).toMatchObject({ type: "trust_badges", variant: "strip" })
  })
})

describe("the theme's settings and a menu set in the design (adr/0063 §3)", () => {
  const theme = (
    primary: string | null,
    radius: StoreThemeSettings["radius"]
  ): StoreThemeSettings => ({
    theme: "atolye",
    colors: { primary, accent: null, background: "steel" },
    typography: { heading: "manrope", body: "manrope" },
    radius,
    product_card: DEFAULT_THEME.product_card,
    header: { layout: "left", sticky: true },
    buttons: "pill",
    section_spacing: "normal",
    surface_style: "filled",
    menu_style: "filled",
    shadow: "float",
    chip_style: "filled",
    media_ground: "well",
  })
  const frame = { primary_color: "#0b5c99" } as Parameters<typeof themeSourceOf>[1]["storefront"]
  const menu = (title: string): StoreMenu => ({ title, location: "main", rank: 0, items: [] })

  it("draws the design's theme (a preview's draft), its 'none' kept over the old main colour", () => {
    const design = theme(null, "round")
    expect(
      themeSourceOf(
        { settings: { ...DESIGN, theme: design } },
        { theme: theme(null, "soft"), storefront: frame }
      )
    ).toEqual([design, null])
  })

  it("falls back to the frame's theme from a backend before the move, and to the old colour before any theme", () => {
    const old = theme("#7a1a48", "sharp")
    expect(themeSourceOf({ settings: DESIGN }, { theme: old, storefront: frame })).toEqual([
      old,
      null,
    ])
    expect(themeSourceOf({}, { storefront: frame })).toEqual([undefined, "#0b5c99"])
  })

  it("prints a preview's menu set instead of the live menus, and the live ones otherwise", () => {
    const live = [menu("Mağaza menüsü")]
    const set = [menu("Görünüm menüsü")]
    expect(menusOf({ settings: { ...DESIGN, menus: set } }, live)).toBe(set)
    expect(menusOf({ settings: { ...DESIGN, menus: null } }, live)).toBe(live)
    expect(menusOf({}, live)).toBe(live)
    // A set left empty takes every menu away, as publishing it would
    expect(menusOf({ settings: { ...DESIGN, menus: [] } }, live)).toEqual([])
  })
})
