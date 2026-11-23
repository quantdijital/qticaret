import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import {
  NO_DATED,
  cardDatesOf,
  datedFromForm,
  datedFromSearch,
  datedWords,
  isFormAddress,
  rangeOfDays,
  rangeWords,
} from "../dated-search"
import { hrefOf, stateFromSearch } from "../listing"
import { canonicalSearchPath, searchStateOf, searchTitle } from "../search"

const read = (search: string) => new URLSearchParams(search)

// adr/0077 §2: a search's category, dates and party beside the listing's filters
describe("a date search's address", () => {
  it("reads the category, a range over months and the party, never as filters", () => {
    const state = stateFromSearch(
      read("kategori=kultur-turlari&tarih=2026-12-01_2026-12-10&ay=2027-01&kisi=2&renk=mavi")
    )
    expect(state.filters).toEqual([["renk", ["mavi"]]])
    expect(state.dated).toEqual({
      category: "kultur-turlari",
      range: "2026-12-01_2026-12-10",
      months: null,
      pax: 2,
    })
    expect(datedFromSearch(read("ay=2026-12,2027-01"))).toEqual({
      ...NO_DATED,
      months: "2026-12,2027-01",
    })
  })

  it("leaves out what is not of its form, and a party of one or past twenty", () => {
    expect(datedFromSearch(read("kategori=Kültür&tarih=1-10%20Ara&ay=aralik&kisi=21"))).toEqual(
      NO_DATED
    )
    expect(stateFromSearch(read("renk=mavi")).dated).toBeUndefined()
  })

  it("writes them as the backend's canonical form: after the filters, before price, sort and page", () => {
    const state = searchStateOf(
      read(
        "sayfa=2&kisi=3&sirala=kalkis&fiyat=100-&tarih=2026-12-01_2026-12-10&kategori=yurt-ici&marka=ac&q=kapadokya"
      )
    )
    expect(hrefOf("/arama", state)).toBe(
      "/arama?q=kapadokya&marka=ac&kategori=yurt-ici&tarih=2026-12-01_2026-12-10&kisi=3&fiyat=100-&sirala=kalkis&sayfa=2"
    )
  })

  it("moves to the canonical query the backend gives, the words first", () => {
    expect(canonicalSearchPath("çakı", "tarih=2026-12-01_2026-12-10")).toBe(
      "/arama?q=%C3%A7ak%C4%B1&tarih=2026-12-01_2026-12-10"
    )
    expect(canonicalSearchPath("", "kategori=yurt-ici")).toBe("/arama?kategori=yurt-ici")
    expect(canonicalSearchPath("", "")).toBe("/arama")
  })
})

describe("the search box's GET form", () => {
  it("is known by its day fields, an empty field or a party of one", () => {
    expect(isFormAddress(read("tarih_baslangic=2026-12-01&tarih_bitis=2026-12-10"))).toBe(true)
    expect(isFormAddress(read("q=&kategori=yurt-ici"))).toBe(true)
    expect(isFormAddress(read("kategori=yurt-ici&kisi=1"))).toBe(true)
    expect(isFormAddress(read("kategori=yurt-ici&kisi=2"))).toBe(false)
    expect(isFormAddress(read("q=kapadokya"))).toBe(false)
  })

  it("reads its two days as one range: one day alone, two the other way round", () => {
    expect(rangeOfDays("2026-12-01", "2026-12-10")).toBe("2026-12-01_2026-12-10")
    expect(rangeOfDays("2026-12-10", "2026-12-01")).toBe("2026-12-01_2026-12-10")
    expect(rangeOfDays("2026-12-05", "")).toBe("2026-12-05_2026-12-05")
    expect(rangeOfDays("", "2026-12-05")).toBe("2026-12-05_2026-12-05")
    expect(rangeOfDays("", "")).toBeNull()
  })

  it("puts the range over a month chosen beside it", () => {
    expect(
      datedFromForm(
        read("tarih_baslangic=2026-12-01&tarih_bitis=2026-12-10&ay=2027-01&kisi=2&kategori=")
      )
    ).toEqual({ category: null, range: "2026-12-01_2026-12-10", months: null, pax: 2 })
    expect(datedFromForm(read("tarih_baslangic=&tarih_bitis=&ay=2027-01"))).toEqual({
      ...NO_DATED,
      months: "2027-01",
    })
  })
})

describe("a date search in words", () => {
  it("says a range without the year, in one month or across two", () => {
    expect(rangeWords("2026-12-01_2026-12-10")).toBe("1–10 Ara")
    expect(rangeWords("2026-11-28_2026-12-03")).toBe("28 Kas – 3 Ara")
    expect(rangeWords("2026-12-05_2026-12-05")).toBe("5 Ara")
  })

  it("says the months and the party", () => {
    expect(datedWords({ ...NO_DATED, months: "2026-12,2027-01", pax: 2 }, t)).toEqual([
      "Aralık 2026, Ocak 2027",
      "2 kişi",
    ])
    expect(datedWords(NO_DATED, t)).toEqual([])
  })

  it("titles a search by its words, category, values, dates and party", () => {
    const state = searchStateOf(
      read("gidilecek_yer=kapadokya&kategori=kultur&tarih=2026-12-01_2026-12-10&kisi=2")
    )
    const attributes = [
      {
        key: "gidilecek_yer",
        label: "Gidilecek yer",
        values: [{ value: "kapadokya", label: "Kapadokya", count: 3, selected: true }],
      },
    ]
    const categories = [{ handle: "kultur", name: "Kültür turları" }]
    expect(searchTitle(state, categories, attributes, t)).toBe(
      "Kültür turları · Kapadokya · 1–10 Ara · 2 kişi"
    )
    expect(searchTitle({ ...state, q: "balon" }, [], [], t)).toBe(
      "“balon” için sonuçlar · 1–10 Ara · 2 kişi"
    )
    expect(searchTitle(searchStateOf(read("")), [], [], t)).toBe("Arama")
  })
})

describe("a date search's cards", () => {
  it("are asked with its range or months and a party over one", () => {
    expect(cardDatesOf({ ...NO_DATED, range: "2026-12-01_2026-12-10", pax: 2 })).toEqual({
      from: "2026-12-01",
      to: "2026-12-10",
      pax: 2,
    })
    expect(cardDatesOf({ ...NO_DATED, months: "2026-12" })).toEqual({ months: "2026-12" })
    expect(cardDatesOf({ ...NO_DATED, category: "kultur", pax: 3 })).toBeNull()
    expect(cardDatesOf(undefined)).toBeNull()
  })
})
