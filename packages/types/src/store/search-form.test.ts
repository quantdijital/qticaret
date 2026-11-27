import { describe, expect, it } from "vitest"
import { SEARCH_FORM_CATEGORY_STYLES, SEARCH_FORM_DEFAULTS, searchFormOf } from "./search-form.js"

/** adr/0077 §1: the search box's fields, one theme setting. */
describe("search form settings", () => {
  it("defaults to every field on, no attribute and a drop-down of categories", () => {
    expect(SEARCH_FORM_DEFAULTS).toEqual({
      attribute_key: null,
      show_category: true,
      show_dates: true,
      show_people: true,
      flexible_month: true,
      date_words: false,
      boxed_fields: false,
      category_style: "select",
      tabs: [],
      tab_all: true,
      placeholder: null,
    })
    expect(SEARCH_FORM_CATEGORY_STYLES).toEqual(["select", "tabs"])
  })

  it("reads a missing or unknown value as its default", () => {
    expect(searchFormOf(undefined)).toEqual(SEARCH_FORM_DEFAULTS)
    expect(searchFormOf(null)).toEqual(SEARCH_FORM_DEFAULTS)
    expect(
      searchFormOf({
        attribute_key: "Gidilecek Yer",
        show_dates: "yes",
        category_style: "pills",
      })
    ).toEqual(SEARCH_FORM_DEFAULTS)
  })

  it("keeps each well-formed tab once, a malformed icon none, at most eight", () => {
    const tabs = [
      { handle: "yurt-ici", icon: "map_pin" },
      { handle: "yurt-ici", icon: "plane" },
      { handle: "Gemi Turlari", icon: "palm" },
      { handle: "gemi", icon: "Ship!" },
      "atolye",
      ...Array.from({ length: 9 }, (_, at) => ({ handle: `k${String(at)}` })),
    ]
    expect(searchFormOf({ tabs }).tabs).toEqual([
      { handle: "yurt-ici", icon: "map_pin" },
      { handle: "gemi", icon: null },
      ...Array.from({ length: 6 }, (_, at) => ({ handle: `k${String(at)}`, icon: null })),
    ])
    expect(searchFormOf({ tabs: "gemi" }).tabs).toEqual([])
  })

  it("keeps the shop's choices", () => {
    expect(
      searchFormOf({
        attribute_key: "gidilecek_yer",
        show_category: false,
        show_dates: false,
        show_people: false,
        flexible_month: false,
        date_words: true,
        boxed_fields: true,
        category_style: "tabs",
        tabs: [{ handle: "gemi-turlari", icon: "palm" }],
        tab_all: false,
        placeholder: "  Nereye gitmek istersiniz?  ",
      })
    ).toEqual({
      attribute_key: "gidilecek_yer",
      show_category: false,
      show_dates: false,
      show_people: false,
      flexible_month: false,
      date_words: true,
      boxed_fields: true,
      category_style: "tabs",
      tabs: [{ handle: "gemi-turlari", icon: "palm" }],
      tab_all: false,
      placeholder: "Nereye gitmek istersiniz?",
    })
  })
})
