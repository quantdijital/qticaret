import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { filterViews } from "../facets"
import { hrefOf, listingQueryOf, searchOf, withPage, withSort } from "../listing"
import { searchHelp, searchPath, searchStateOf } from "../search"

const read = (query: string) => searchStateOf(new URLSearchParams(query))

const related = {
  suggestions: ["şef bıçağı", "ekmek bıçağı"],
  related: {
    categories: [
      { id: "pcat_1", name: "Şef bıçakları" },
      { id: "pcat_2", name: "Arşiv" },
    ],
    brands: [
      { id: "brand_1", name: "Zwilling", handle: "zwilling" },
      { id: "brand_2", name: "Arcos", handle: "arcos" },
    ],
  },
  took_ms: 4,
}

describe("the search page's address (/arama)", () => {
  it("reads the words apart from the listing's own query", () => {
    const state = read("q=+b%C4%B1cak++&marka=arcos&sirala=yeni&sayfa=2&utm_source=x")
    expect(state.q).toBe("bıcak")
    expect(state.filters).toEqual([["marka", ["arcos"]]])
    expect(state.sort).toBe("yeni")
    expect(state.page).toBe(2)
    // The listing route reads its own query; the words go as `q`
    expect(listingQueryOf(state)).toBe("marka=arcos&sirala=yeni&sayfa=2")
  })

  it("keeps the words to what the backend reads, the first q when several came", () => {
    expect(read("q=a&q=b").q).toBe("a")
    expect(read("").q).toBe("")
    expect(read(`q=${"x".repeat(150)}`).q).toHaveLength(100)
    // Never half an emoji at the cut
    expect(read(`q=${encodeURIComponent(`${"x".repeat(99)}😀`)}`).q).toBe("x".repeat(99))
  })

  it("keeps the words in every link of the page: sort, pages, filters and the price form", () => {
    const state = read("q=şef bıçağı&marka=arcos")
    expect(searchOf(state)).toBe("q=%C5%9Fef+b%C4%B1%C3%A7a%C4%9F%C4%B1&marka=arcos")
    expect(hrefOf("/arama", withPage(withSort(state, "fiyat-artan"), 3))).toBe(
      "/arama?q=%C5%9Fef+b%C4%B1%C3%A7a%C4%9F%C4%B1&marka=arcos&sirala=fiyat-artan&sayfa=3"
    )
    const facets = filterViews(
      "/arama",
      state,
      {
        brands: [
          { value: "arcos", label: "Arcos", count: 3, selected: true },
          { value: "zwilling", label: "Zwilling", count: 2, selected: false },
        ],
        attributes: [],
        price: { min: 100, max: 900 },
      },
      false,
      t
    )
    expect(facets.clearPath).toBe("/arama?q=%C5%9Fef+b%C4%B1%C3%A7a%C4%9F%C4%B1")
    expect(facets.price?.keep).toEqual([
      { name: "q", value: "şef bıçağı" },
      { name: "marka", value: "arcos" },
    ])
  })

  it("writes a new search from its first page", () => {
    expect(searchPath("şef bıçağı")).toBe("/arama?q=%C5%9Fef+b%C4%B1%C3%A7a%C4%9F%C4%B1")
  })
})

describe("the search's help", () => {
  it("links each suggestion, each related category at its page, each brand as a filter", () => {
    const state = read("q=bicak")
    expect(searchHelp(state, related, { pcat_1: "/kategori/sef-bicaklari" })).toEqual({
      suggestions: [
        { label: "şef bıçağı", path: "/arama?q=%C5%9Fef+b%C4%B1%C3%A7a%C4%9F%C4%B1" },
        { label: "ekmek bıçağı", path: "/arama?q=ekmek+b%C4%B1%C3%A7a%C4%9F%C4%B1" },
      ],
      // A category without a live path is no link
      categories: [{ label: "Şef bıçakları", path: "/kategori/sef-bicaklari" }],
      brands: [
        { label: "Zwilling", path: "/arama?q=bicak&marka=zwilling" },
        { label: "Arcos", path: "/arama?q=bicak&marka=arcos" },
      ],
    })
  })

  it("adds a brand to those chosen, from the first page, and leaves out one chosen already", () => {
    const state = read("q=bicak&marka=arcos&sayfa=3")
    expect(searchHelp(state, related, {})?.brands).toEqual([
      { label: "Zwilling", path: "/arama?q=bicak&marka=arcos,zwilling" },
    ])
  })

  it("is nothing when there is nothing to offer", () => {
    const state = read("q=bicak")
    expect(searchHelp(state, undefined, {})).toBeNull()
    expect(
      searchHelp(
        state,
        { suggestions: [], related: { categories: [], brands: [] }, took_ms: 1 },
        {}
      )
    ).toBeNull()
  })
})
