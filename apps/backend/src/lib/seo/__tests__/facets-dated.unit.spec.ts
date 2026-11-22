import {
  filterKeysOf,
  isNarrowed,
  isReservedParam,
  listingSearch,
  readListingQuery,
} from "../facets"
import type { ListingQuery, ListingReadOptions } from "../facets"
import { categoryOf, monthsOf, paxOf, rangeOf, todayIn } from "../facets-dated"

const TODAY = "2026-11-23"
const KEYS = filterKeysOf(["renk", "tarih", "kisi"])
const ON: ListingReadOptions = { booking: true, today: TODAY }

const listing = (search: string, options: ListingReadOptions = ON) => {
  const result = readListingQuery(new URLSearchParams(search), KEYS, options)
  if (result.kind !== "listing") {
    throw new Error("not a listing")
  }
  return result
}
const canonical = (search: string, options: ListingReadOptions = ON) =>
  listingSearch(listing(search, options).query)

/** adr/0077 §2, docs/13 §7: a listing's date search parameters. */
describe("a date search's parameters", () => {
  describe("tarih", () => {
    it.each([
      ["from today on", "2026-11-23_2026-11-30", true],
      ["a single day", "2026-12-01_2026-12-01", true],
      ["62 days, both ends included", "2026-12-01_2027-01-31", true],
      ["63 days", "2026-12-01_2027-02-01", false],
      ["a start before today", "2026-11-22_2026-11-30", false],
      ["an end before the start", "2026-12-05_2026-12-01", false],
      ["a day the calendar has not", "2026-02-30_2026-03-02", false],
      ["another form", "2026-12-01..2026-12-05", false],
    ])("%s", (_, raw, ok) => {
      expect(rangeOf(raw, TODAY) !== null).toBe(ok)
    })
  })

  describe("ay", () => {
    it("keeps the months within this one and the next eleven, sorted, distinct, three at most", () => {
      expect(monthsOf("2027-01,2026-12,2026-12", TODAY)).toEqual({
        kind: "months",
        months: ["2026-12", "2027-01"],
      })
      expect(monthsOf("2026-11", TODAY)).toEqual({ kind: "months", months: ["2026-11"] })
      expect(monthsOf("2027-10", TODAY)).toEqual({ kind: "months", months: ["2027-10"] })
      expect(monthsOf("2027-11", TODAY)).toBeNull()
      expect(monthsOf("2026-10", TODAY)).toBeNull()
      expect(monthsOf("2026-13,kasim", TODAY)).toBeNull()
      expect(monthsOf("2026-12,2027-01,2027-02,2027-03", TODAY)).toEqual({
        kind: "months",
        months: ["2026-12", "2027-01", "2027-02"],
      })
    })
  })

  it("reads kisi 1..20 and a category handle", () => {
    expect([
      paxOf("4"),
      paxOf("20"),
      paxOf("21"),
      paxOf("0"),
      paxOf("04"),
      paxOf(undefined),
    ]).toEqual([4, 20, 1, 1, 1, 1])
    expect(categoryOf("doga-turlari")).toBe("doga-turlari")
    expect(categoryOf("Doga Turlari")).toBeNull()
  })

  it("says today in the shop's zone", () => {
    // 22:30 UTC is already the next day in Istanbul (UTC+3)
    expect(todayIn(new Date("2026-11-23T22:30:00Z"))).toBe("2026-11-24")
  })

  it("reserves the names: no filterable attribute takes them", () => {
    for (const name of ["kategori", "tarih", "ay", "kisi"]) {
      expect(isReservedParam(name)).toBe(true)
    }
    expect([...KEYS]).toEqual(["renk"])
  })
})

describe("a listing query with dates", () => {
  it("keeps a canonical query: filters, kategori, dates, kisi, then fiyat, sirala, sayfa", () => {
    const search =
      "renk=mavi&kategori=doga&tarih=2026-12-01_2026-12-05&kisi=3&fiyat=-500&sirala=kalkis&sayfa=2"
    const { query, isCanonical } = listing(search, { ...ON, search: true })
    expect(isCanonical).toBe(true)
    expect(query).toMatchObject({
      category: "doga",
      dates: { kind: "range", from: "2026-12-01", to: "2026-12-05" },
      pax: 3,
      sort: "kalkis",
    })
    expect(listingSearch(query)).toBe(search)
    expect(isNarrowed(query)).toBe(true)
  })

  it.each([
    [
      "tarih and ay together keep tarih",
      "ay=2026-12&tarih=2026-12-01_2026-12-05",
      "tarih=2026-12-01_2026-12-05",
    ],
    ["kisi=1 is not written", "kisi=1&ay=2026-12", "ay=2026-12"],
    ["months in order", "ay=2027-01,2026-12", "ay=2026-12,2027-01"],
    ["a past range is dropped", "tarih=2026-01-01_2026-01-05&renk=mavi", "renk=mavi"],
    ["another order", "kisi=2&renk=mavi&ay=2026-12", "renk=mavi&ay=2026-12&kisi=2"],
  ])("moves %s with one 301", (_, search, target) => {
    expect(listing(search).isCanonical).toBe(false)
    expect(canonical(search)).toBe(target)
    // The target reads as itself
    expect(listing(target).isCanonical).toBe(true)
  })

  it("drops the dates, the party and kalkis while the shop sells no dated products", () => {
    const off: ListingReadOptions = { booking: false, today: TODAY }
    const { query, isCanonical } = listing(
      "renk=mavi&tarih=2026-12-01_2026-12-05&kisi=3&sirala=kalkis",
      off
    )
    expect(isCanonical).toBe(false)
    expect(query.dates).toBeUndefined()
    expect(query.pax).toBeUndefined()
    expect(query.sort).toBeNull()
    expect(listingSearch(query)).toBe("renk=mavi")
    // Nor are they kept as other parameters
    expect(query.rest).toEqual([])
  })

  it("reads kategori on the search only: elsewhere it is any other parameter", () => {
    const page = listing("kategori=doga&renk=mavi")
    expect(page.isCanonical).toBe(true)
    expect(page.query.category).toBeUndefined()
    expect(page.query.rest).toEqual([["kategori", "doga"]])
    const search = listing("kategori=doga", { ...ON, search: true })
    expect(search.query.category).toBe("doga")
    expect(search.query.rest).toEqual([])
  })

  it("reads a query without the new parameters as before", () => {
    const before: ListingQuery = {
      filters: [["renk", ["mavi"]]],
      price: null,
      sort: "yeni",
      page: 1,
      rest: [["utm_source", "x"]],
    }
    const read = listing("renk=mavi&sirala=yeni&utm_source=x")
    expect(read.query).toEqual(before)
    expect(read.isCanonical).toBe(true)
  })
})
