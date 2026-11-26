import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreHeroFull } from "@qticaret/types"
import { HERO_FULL_DEFAULTS } from "@qticaret/types/section-hero-full"
import type { SearchFormView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

const FORM = { action: "/arama", label: "Arama" } as SearchFormView
const BADGES = ["Güvenli ödeme", "Hızlı kargo", "Kolay iade", "Yerinde destek", "Beşinci"].map(
  (title) => ({ icon: "shield" as const, title, text: null })
)

// The shop's one search box and the design's shared settings, as the request reads them
const search = vi.hoisted(() => ({ currentSearchForm: vi.fn() }))
vi.mock("../search-form-data", () => search)
const layout = vi.hoisted(() => ({ currentShared: vi.fn() }))
vi.mock("../layout", () => layout)
// Whether the shop chose an accent face, read only for an opening with a note
const theme = vi.hoisted(() => ({ noteInHand: vi.fn() }))
vi.mock("../theme-settings", () => theme)

const { heroFullParts, heroFullView } = await import("../hero-full")

const section = (over: Partial<StoreHeroFull> = {}): StoreHeroFull => ({
  variant: "full_image",
  ...over,
})

beforeEach(() => {
  search.currentSearchForm.mockReset()
  search.currentSearchForm.mockResolvedValue(FORM)
  layout.currentShared.mockReset()
  layout.currentShared.mockResolvedValue({ trust_badges: BADGES, color_swatches: [] })
  theme.noteInHand.mockReset()
  theme.noteInHand.mockResolvedValue(false)
})

// adr/0077 §9: the full image opening's parts
describe("heroFullParts", () => {
  it("takes the defaults for a section that names nothing: buttons, no accent, no badges", () => {
    expect(heroFullParts(section(), { search: FORM, badges: BADGES })).toEqual({
      settings: HERO_FULL_DEFAULTS,
      accent: null,
      search: null,
      trust: [],
      video: null,
    })
  })

  it("carries the video's host and id only, never the pasted link, with the button's words", () => {
    const source = { search: null, badges: [] }
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"

    expect(
      heroFullParts(section({ video_url: url, video_label: " Tanıtım " }), source).video
    ).toEqual({ host: "youtube", id: "dQw4w9WgXcQ", label: "Tanıtım" })
    expect(heroFullParts(section({ video_url: "vimeo.com/76979871" }), source).video).toEqual({
      host: "vimeo",
      id: "76979871",
      label: null,
    })
    expect(heroFullParts(section({ video_url: "https://evil.example/v" }), source).video).toBeNull()
    expect(heroFullParts(section({ video_label: "Tanıtım" }), source).video).toBeNull()
  })

  it("reads a step off its list as its default, a listed one as it is", () => {
    const parts = heroFullParts(
      section({ height: "tall", edge: "wave", scrim: "max" as never, image_side: "end" }),
      { search: null, badges: [] }
    )

    expect(parts.settings).toEqual({
      ...HERO_FULL_DEFAULTS,
      height: "tall",
      edge: "wave",
      image_side: "end",
    })
  })

  it("carries the search box only when the opening asks for a search", () => {
    const source = { search: FORM, badges: [] }

    expect(heroFullParts(section({ action: "search" }), source).search).toBe(FORM)
    expect(heroFullParts(section({ action: "button" }), source).search).toBeNull()
  })

  it("shows at most four of the shop's badges, and only when the shop shows them", () => {
    const source = { search: null, badges: BADGES }

    expect(heroFullParts(section({ show_trust: true }), source).trust).toEqual(BADGES.slice(0, 4))
    expect(heroFullParts(section({ show_trust: false }), source).trust).toEqual([])
  })

  it("leaves an accent line of spaces out", () => {
    const source = { search: null, badges: [] }

    expect(heroFullParts(section({ title_accent: "  " }), source).accent).toBeNull()
    expect(heroFullParts(section({ title_accent: " Kaçışını bul " }), source).accent).toBe(
      "Kaçışını bul"
    )
  })

  it("carries a last line only when there is one, trimmed", () => {
    const source = { search: null, badges: [] }

    expect(heroFullParts(section({}), source)).not.toHaveProperty("after")
    expect(heroFullParts(section({ title_after: "  " }), source)).not.toHaveProperty("after")
    expect(heroFullParts(section({ title_after: " Sıradanın ötesi " }), source).after).toBe(
      "Sıradanın ötesi"
    )
  })
})

describe("heroFullView", () => {
  it("reads neither the search box nor the badges for an opening that shows neither", async () => {
    const view = await heroFullView(section(), t)

    expect(view).toEqual({
      settings: HERO_FULL_DEFAULTS,
      accent: null,
      search: null,
      trust: [],
      video: null,
    })
    expect(search.currentSearchForm).not.toHaveBeenCalled()
    expect(layout.currentShared).not.toHaveBeenCalled()
  })

  it("carries the hand note in the accent face when the shop chose one, else italic", async () => {
    theme.noteInHand.mockResolvedValue(true)
    expect((await heroFullView(section({ note: " Sizi bekliyoruz! " }), t)).note).toEqual({
      text: "Sizi bekliyoruz!",
      hand: true,
    })
    expect(theme.noteInHand).toHaveBeenCalledWith(" Sizi bekliyoruz! ")

    theme.noteInHand.mockResolvedValue(false)
    expect((await heroFullView(section({ note: "Merhaba" }), t)).note).toEqual({
      text: "Merhaba",
      hand: false,
    })
    // None, or spaces: no note in the view at all (the opening as before it)
    expect(await heroFullView(section({ note: "   " }), t)).not.toHaveProperty("note")
  })

  it("reads the shop's one search box and its badges when the opening shows them", async () => {
    const view = await heroFullView(section({ action: "search", show_trust: true }), t)

    expect(view.search).toBe(FORM)
    expect(view.trust).toHaveLength(4)
    expect(search.currentSearchForm).toHaveBeenCalledTimes(1)
  })
})
