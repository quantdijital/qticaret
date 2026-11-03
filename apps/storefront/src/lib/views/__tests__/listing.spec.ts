import { describe, expect, it } from "vitest"
import {
  IN_STOCK,
  STOCK,
  cleared,
  hrefOf,
  isInStockOnly,
  priceAsked,
  stateFromSearch,
  stateOf,
  toggled,
  withPage,
  withPrice,
  withSort,
} from "../listing"

const plain = stateOf(undefined)

describe("listing addresses (D4)", () => {
  it("writes the backend's canonical order: marka first, keys and values sorted", () => {
    let state = toggled(plain, "renk", "mavi")
    state = toggled(state, "marka", "zeta")
    state = toggled(state, "celik", "n690")
    state = toggled(state, "renk", "kirmizi")
    state = withSort(state, "fiyat-artan")
    expect(hrefOf("/kategori/caki", { ...state, price: { min: 100, max: null } })).toBe(
      "/kategori/caki?marka=zeta&celik=n690&renk=kirmizi,mavi&fiyat=100-&sirala=fiyat-artan"
    )
  })

  it("lets a chosen value go, starts filters over at page one, never writes sayfa=1", () => {
    const paged = withPage(toggled(plain, "renk", "mavi"), 3)
    expect(hrefOf("/k", paged)).toBe("/k?renk=mavi&sayfa=3")
    expect(hrefOf("/k", toggled(paged, "renk", "mavi"))).toBe("/k")
    expect(hrefOf("/k", withPage(plain, 1))).toBe("/k")
  })

  it("reads the price form's two fields as one range, ends swapped when crossed", () => {
    const read = (search: string) => priceAsked(new URLSearchParams(search))
    expect(read("")).toBeUndefined()
    expect(read("fiyat_en_az=100&fiyat_en_cok=")).toEqual({ min: 100, max: null })
    expect(read("fiyat_en_az=900&fiyat_en_cok=100")).toEqual({ min: 100, max: 900 })
    expect(read("fiyat_en_az=abc&fiyat_en_cok=")).toBeNull()
  })
})

describe("the in-stock filter in the address (stok=var, adr/0056)", () => {
  const inStock = (state: typeof plain) => toggled(state, STOCK, IN_STOCK)

  it("sits among the attribute keys in code-point order, after marka, before fiyat", () => {
    let state = toggled(plain, "uzunluk", "20-cm")
    state = inStock(state)
    state = toggled(state, "renk", "mavi")
    state = toggled(state, "marka", "arcos")
    state = withPrice(state, { min: 100, max: 500 })
    expect(hrefOf("/kategori/caki", withSort(state, "yeni"))).toBe(
      "/kategori/caki?marka=arcos&renk=mavi&stok=var&uzunluk=20-cm&fiyat=100-500&sirala=yeni"
    )
    // Alone, it is the whole query
    expect(hrefOf("/magaza", inStock(plain))).toBe("/magaza?stok=var")
  })

  it("comes off by the same toggle, from the first page, the rest kept", () => {
    const on = withPage(inStock(toggled(plain, "renk", "mavi")), 3)
    expect(isInStockOnly(on)).toBe(true)
    expect(hrefOf("/k", on)).toBe("/k?renk=mavi&stok=var&sayfa=3")
    const off = inStock(on)
    expect(isInStockOnly(off)).toBe(false)
    expect(hrefOf("/k", off)).toBe("/k?renk=mavi")
    expect(hrefOf("/k", cleared(on))).toBe("/k")
  })

  it("rides along every page and every sort", () => {
    const on = inStock(plain)
    expect(hrefOf("/k", withPage(on, 2))).toBe("/k?stok=var&sayfa=2")
    expect(hrefOf("/k", withSort(withPage(on, 2), "fiyat-azalan"))).toBe(
      "/k?stok=var&sirala=fiyat-azalan"
    )
  })

  it("is read from a page resolve does not answer, its one value only", () => {
    const read = (search: string) => stateFromSearch(new URLSearchParams(search))
    expect(read("stok=var&renk=mavi").filters).toEqual([
      ["renk", ["mavi"]],
      ["stok", ["var"]],
    ])
    expect(read("stok=yok").filters).toEqual([])
    expect(read("stok=VAR,yok").filters).toEqual([["stok", ["var"]]])
    // And as the backend read it from the address (resolve's `listing`)
    expect(
      isInStockOnly(
        stateOf({ filters: { stok: ["var"] }, price: null, sort: null, page: 1, page_size: 24 })
      )
    ).toBe(true)
  })
})
