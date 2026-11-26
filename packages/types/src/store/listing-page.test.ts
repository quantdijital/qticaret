import { describe, expect, it } from "vitest"
import {
  LISTING_BREADCRUMB_CURRENTS,
  LISTING_COUNT_WORD_MAX,
  LISTING_PAGE_DEFAULTS,
  LISTING_VIEWS,
  LISTING_VIEW_SWITCHES,
  listingPageOf,
} from "./listing-page.js"

/** A listing page's layout: one theme setting, today's page by default (adr/0066). */
describe("listing page settings", () => {
  it("defaults to today's page: a grid, no switch, the trail to the page itself", () => {
    expect(LISTING_PAGE_DEFAULTS).toEqual({
      default_view: "grid",
      view_switch: "hide",
      breadcrumb_current: "show",
      count_word: null,
    })
    expect(LISTING_VIEWS).toContain(LISTING_PAGE_DEFAULTS.default_view)
    expect(LISTING_VIEW_SWITCHES).toContain(LISTING_PAGE_DEFAULTS.view_switch)
    expect(LISTING_BREADCRUMB_CURRENTS).toContain(LISTING_PAGE_DEFAULTS.breadcrumb_current)
  })

  it("reads none (a backend before it) and unknown values at their defaults", () => {
    expect(listingPageOf(undefined)).toEqual(LISTING_PAGE_DEFAULTS)
    expect(listingPageOf(null)).toEqual(LISTING_PAGE_DEFAULTS)
    expect(
      listingPageOf({
        default_view: "table",
        view_switch: true,
        breadcrumb_current: 1,
        count_word: 3,
      })
    ).toEqual(LISTING_PAGE_DEFAULTS)
    expect(
      listingPageOf({ default_view: "list", view_switch: "show", breadcrumb_current: "hide" })
    ).toEqual({
      default_view: "list",
      view_switch: "show",
      breadcrumb_current: "hide",
      count_word: null,
    })
  })

  it("reads the count's word trimmed, an empty one as none, a long one cut", () => {
    expect(listingPageOf({ count_word: "  tur " }).count_word).toBe("tur")
    expect(listingPageOf({ count_word: "   " }).count_word).toBeNull()
    expect(listingPageOf({ count_word: "x".repeat(40) }).count_word).toBe(
      "x".repeat(LISTING_COUNT_WORD_MAX)
    )
  })
})
