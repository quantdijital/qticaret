import { describe, expect, it } from "vitest"
import { stateFromSearch } from "../listing"
import { sortOptions } from "../listing-sort"

const t = (key: string) => key
const read = (search: string) => stateFromSearch(new URLSearchParams(search))

describe("a listing's sorts", () => {
  it("links each in canonical form from the first page, the grid or list kept", () => {
    const sorts = sortOptions(
      "/magaza",
      read("renk=mavi&sirala=yeni&sayfa=2&gorunum=liste"),
      { isSearch: false, retailOnly: false, dated: false },
      t
    )
    expect(sorts.map(({ label, path, current }) => [label, path, current])).toEqual([
      ["listing.sort_recommended", "/magaza?renk=mavi&gorunum=liste", false],
      ["listing.sort_newest", "/magaza?renk=mavi&sirala=yeni&gorunum=liste", true],
      ["listing.sort_price_up", "/magaza?renk=mavi&sirala=fiyat-artan&gorunum=liste", false],
      ["listing.sort_price_down", "/magaza?renk=mavi&sirala=fiyat-azalan&gorunum=liste", false],
    ])
  })

  it("says relevance on a search, retail to a wholesaler, departure with dates", () => {
    const sorts = sortOptions(
      "/arama",
      read("ay=2026-12"),
      { isSearch: true, retailOnly: true, dated: true },
      t
    ).map(({ label }) => label)
    expect(sorts).toEqual([
      "search.sort_relevance",
      "listing.sort_newest",
      "listing.sort_retail_price_up",
      "listing.sort_retail_price_down",
      "search.sort_departure",
    ])
  })
})
