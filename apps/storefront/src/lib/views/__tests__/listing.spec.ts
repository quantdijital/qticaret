import { describe, expect, it } from "vitest"
import { hrefOf, priceAsked, stateOf, toggled, withPage, withSort } from "../listing"

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
