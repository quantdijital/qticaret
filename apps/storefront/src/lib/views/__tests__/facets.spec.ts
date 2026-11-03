import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { filterViews } from "../facets"
import { stateOf, stateFromSearch, withPage } from "../listing"
import { searchStateOf } from "../search"

/**
 * "Yalnızca stokta olanlar" (adr/0056) as the listing's filters offer it:
 * the listing route's `facets.stock` becomes one toggle link with its
 * count, its chip among what is chosen, kept by the price form.
 */

const LABEL = "Yalnızca stokta olanlar"

const facets = (stock?: ListingAnswer["facets"]["stock"]): ListingAnswer["facets"] => ({
  brands: [
    { value: "arcos", label: "Arcos", count: 3, selected: false },
    { value: "zwilling", label: "Zwilling", count: 2, selected: false },
  ],
  attributes: [
    {
      key: "renk",
      label: "Renk",
      values: [
        { value: "mavi", label: "Mavi", count: 4, selected: false },
        { value: "siyah", label: "Siyah", count: 1, selected: false },
      ],
    },
  ],
  price: { min: 100, max: 900 },
  ...(stock ? { stock } : {}),
})

const read = (search: string) => stateFromSearch(new URLSearchParams(search))

describe("the in-stock toggle (facets.stock)", () => {
  it("is offered off with its count, its link turning stok=var on from page one", () => {
    const views = filterViews(
      "/kategori/caki",
      withPage(read("renk=mavi"), 2),
      facets({ count: 7, selected: false }),
      false,
      t
    )
    expect(views.stock).toEqual({
      label: LABEL,
      count: 7,
      selected: false,
      path: "/kategori/caki?renk=mavi&stok=var",
    })
    expect(views.active.map((chip) => chip.label)).toEqual(["Mavi"])
  })

  it("is on when the address holds it: its link and its chip both take it away", () => {
    const state = read("marka=arcos&renk=mavi&stok=var")
    const views = filterViews(
      "/kategori/caki",
      state,
      facets({ count: 5, selected: true }),
      false,
      t
    )
    expect(views.stock).toMatchObject({
      selected: true,
      count: 5,
      path: "/kategori/caki?marka=arcos&renk=mavi",
    })
    expect(views.active).toEqual([
      { label: "Arcos", path: "/kategori/caki?renk=mavi&stok=var" },
      { label: "Mavi", path: "/kategori/caki?marka=arcos&stok=var" },
      { label: LABEL, path: "/kategori/caki?marka=arcos&renk=mavi" },
    ])
    expect(views.clearPath).toBe("/kategori/caki")
    // The price form keeps it as a hidden field
    expect(views.price?.keep).toContainEqual({ name: "stok", value: "var" })
  })

  it("follows the backend's own reading on a resolved page", () => {
    const state = stateOf({
      filters: { stok: ["var"] },
      price: { min: 100, max: null },
      sort: "yeni",
      page: 1,
      page_size: 24,
    })
    const views = filterViews("/k", state, facets({ count: 2, selected: true }), false, t)
    expect(views.stock?.path).toBe("/k?fiyat=100-&sirala=yeni")
    expect(views.active.map((chip) => chip.label)).toEqual([LABEL, "100,00 TL – …"])
  })

  it("is not offered when the listing route leaves the facet out", () => {
    expect(filterViews("/k", read(""), facets(), false, t).stock).toBeNull()
  })

  it("is not offered when nothing is in stock and it is off, but stays while it is on", () => {
    expect(
      filterViews("/k", read(""), facets({ count: 0, selected: false }), false, t).stock
    ).toBeNull()
    const on = filterViews("/k", read("stok=var"), facets({ count: 0, selected: true }), false, t)
    expect(on.stock).toMatchObject({ selected: true, count: 0, path: "/k" })
  })

  it("keeps a search's words in its link", () => {
    const state = searchStateOf(new URLSearchParams("q=şef&marka=arcos"))
    const views = filterViews("/arama", state, facets({ count: 3, selected: false }), false, t)
    expect(views.stock?.path).toBe("/arama?q=%C5%9Fef&marka=arcos&stok=var")
  })
})
