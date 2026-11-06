import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreLayoutSettings } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { sharedSettingsOf } from "../shared-settings"
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
    expect(strip).toEqual({ id: "guven1", type: "trust_badges", badges: DESIGN.trust_badges })

    shared.current.mockResolvedValueOnce({ trust_badges: [], color_swatches: [] })
    expect(await sectionViews([{ id: "guven1", type: "trust_badges" }], t)).toEqual([])
  })
})
