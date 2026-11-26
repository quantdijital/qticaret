import { describe, expect, it } from "vitest"
import { LISTING_PAGE_DEFAULTS } from "@qticaret/types/listing-page"
import type { ListingPageSettings } from "@qticaret/types/listing-page"
import type { BreadcrumbView } from "@qticaret/ui"
import { hrefOf, listingQueryOf, stateFromSearch, stateOf, viewAsked } from "../listing"
import {
  countWordsOf,
  dateFilterView,
  datedChip,
  layoutOf,
  trailOf,
  viewSwitchView,
} from "../listing-layout"

const t = (key: string) => key
const shop = (patch: Partial<ListingPageSettings> = {}): ListingPageSettings => ({
  ...LISTING_PAGE_DEFAULTS,
  ...patch,
})
const read = (search: string) => stateFromSearch(new URLSearchParams(search))

describe("the shopper's grid or list (gorunum)", () => {
  it("reads liste and izgara, nothing else", () => {
    expect(viewAsked(new URLSearchParams("gorunum=liste"))).toBe("list")
    expect(viewAsked(new URLSearchParams("gorunum=izgara"))).toBe("grid")
    expect(viewAsked(new URLSearchParams("gorunum=tablo"))).toBeNull()
    expect(viewAsked(new URLSearchParams(""))).toBeNull()
  })

  it("rides along every link of the page, last, and is never a filter", () => {
    const state = read("renk=mavi&gorunum=liste&sayfa=2")
    expect(state.filters).toEqual([["renk", ["mavi"]]])
    expect(hrefOf("/magaza", state)).toBe("/magaza?renk=mavi&sayfa=2&gorunum=liste")
  })

  it("never reaches the backend's listing query (the canonical page stays one)", () => {
    expect(listingQueryOf(read("renk=mavi&gorunum=liste"))).toBe("renk=mavi")
  })

  it("is the shopper's only while the shop offers the switch", () => {
    const state = read("gorunum=liste")
    expect(layoutOf(shop(), state)).toBe("grid")
    expect(layoutOf(shop({ view_switch: "show" }), state)).toBe("list")
    expect(layoutOf(shop({ default_view: "list" }), stateOf(undefined))).toBe("list")
  })
})

describe("the view switch", () => {
  it("is none by default (today's page)", () => {
    expect(viewSwitchView("/magaza", stateOf(undefined), shop(), t)).toBeNull()
  })

  it("is a GET form keeping the page's other parameters, the one on pressed", () => {
    const view = viewSwitchView(
      "/magaza",
      read("renk=mavi&sirala=yeni&gorunum=liste"),
      shop({ view_switch: "show" }),
      t
    )
    expect(view).toMatchObject({ action: "/magaza", name: "gorunum" })
    expect(view?.keep).toEqual([
      { name: "renk", value: "mavi" },
      { name: "sirala", value: "yeni" },
    ])
    expect(view?.options.map(({ value, current }) => [value, current])).toEqual([
      ["izgara", false],
      ["liste", true],
    ])
  })
})

describe("the trail's last crumb", () => {
  const home: BreadcrumbView = { label: "Ana sayfa", path: "/" }
  const here: BreadcrumbView = { label: "Tüm ürünler", path: null }

  it("is shown by default and hidden when the shop asks", () => {
    expect(trailOf([home, here], shop())).toEqual([home, here])
    expect(trailOf([home, here], shop({ breadcrumb_current: "hide" }))).toEqual([home])
  })

  it("keeps a trail of one, and a last crumb that is a link", () => {
    const hide = shop({ breadcrumb_current: "hide" })
    expect(trailOf([here], hide)).toEqual([here])
    const linked: BreadcrumbView = { label: "Turlar", path: "/turlar" }
    expect(trailOf([home, linked], hide)).toEqual([home, linked])
  })
})

describe("the count's word (count_word)", () => {
  const said = (key: string, values?: Record<string, string | number>) =>
    `${key}:${values?.["count"] ?? ""}:${values?.["word"] ?? ""}`

  it("says nothing of its own while the shop writes no word (today's ürün)", () => {
    expect(countWordsOf(24, shop(), said)).toEqual({})
  })

  it("counts in the shop's word, the filter sheet's button too", () => {
    expect(countWordsOf(24, shop({ count_word: "tur" }), said)).toEqual({
      countLabel: "listing.count_word:24:tur",
      showResultsLabel: "listing.show_results_word:24:tur",
    })
  })
})

describe("the departure month filter", () => {
  it("offers six months from this one, each asking ay from the first page", () => {
    const view = dateFilterView("/magaza", read("renk=mavi&sayfa=3"), "2026-11-25", t)
    expect(view.options).toHaveLength(6)
    expect(view.options[0]).toEqual({
      label: "Kasım 2026",
      path: "/magaza?renk=mavi&ay=2026-11",
      selected: false,
    })
    expect(view.options[5]?.path).toBe("/magaza?renk=mavi&ay=2027-04")
  })

  it("lets the chosen month go, one month at a time, the grid or list kept", () => {
    const state = read("ay=2026-12&gorunum=liste")
    const view = dateFilterView("/turlar", state, "2026-11-25", t)
    expect(view.options[1]).toMatchObject({ selected: true, path: "/turlar?gorunum=liste" })
    expect(view.options[2]?.path).toBe("/turlar?ay=2027-01&gorunum=liste")
  })

  it("shows the dates asked as a chip that takes them away", () => {
    expect(datedChip("/magaza", read("renk=mavi&ay=2026-12"))).toEqual({
      label: "Aralık 2026",
      path: "/magaza?renk=mavi",
    })
    expect(datedChip("/magaza", read("tarih=2026-12-01_2026-12-10&kisi=2"))).toEqual({
      label: "1–10 Ara",
      path: "/magaza?kisi=2",
    })
    expect(datedChip("/magaza", read("renk=mavi"))).toBeNull()
  })
})
