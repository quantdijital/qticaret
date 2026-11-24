import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { asksReading, understoodPath, understoodView, withoutMark } from "../natural-search"

// Search in the shopper's own words (adr/0077 §7): when it is asked, where it moves, its chips

const params = (query: Record<string, string>) => new URLSearchParams(query)

describe("asksReading", () => {
  it("only while on, for words alone that make a sentence, not read already", () => {
    expect(asksReading(params({ q: "ağustosta iki kişi kapadokya" }), true)).toBe(true)
    expect(asksReading(params({ q: "ağustosta iki kişi kapadokya" }), false)).toBe(false)
    expect(asksReading(params({ q: "kamp bıçağı" }), true)).toBe(false)
    expect(asksReading(params({ q: "  " }), true)).toBe(false)
    expect(asksReading(params({ q: "a b c", kategori: "kultur" }), true)).toBe(false)
    expect(asksReading(params({ q: "a b c", sayfa: "2" }), true)).toBe(false)
    expect(asksReading(params({ q: "a b c", _anlam: "1" }), true)).toBe(false)
  })
})

describe("understoodPath", () => {
  const read = { kind: "kisi", label: "2", param: "kisi", value: "2" }

  it("the canonical query on /arama, marked", () => {
    expect(understoodPath({ query: "q=kamp&kisi=2", understood: [read], dropped: [] })).toBe(
      "/arama?q=kamp&kisi=2&_anlam=1"
    )
  })

  it("none for the words searched as they are, nothing read or a query of another form", () => {
    expect(
      understoodPath({ query: "q=a+b+c", understood: [], dropped: [], fallback: true })
    ).toBeNull()
    expect(understoodPath({ query: "q=a", understood: [], dropped: [] })).toBeNull()
    expect(understoodPath({ query: "", understood: [read], dropped: [] })).toBeNull()
    expect(understoodPath({ query: "?kisi=2", understood: [read], dropped: [] })).toBeNull()
    expect(understoodPath({ query: "kisi=2#x", understood: [read], dropped: [] })).toBeNull()
    expect(understoodPath({ query: "kisi=2 x", understood: [read], dropped: [] })).toBeNull()
  })
})

describe("withoutMark", () => {
  it("drops the mark alone", () => {
    expect(withoutMark(params({ kisi: "2", _anlam: "1" })).toString()).toBe("kisi=2")
  })
})

describe("understoodView", () => {
  const categories = [{ handle: "kultur", name: "Kültür turları" }]

  it("the category and the range by the shop's words, each taking itself away", () => {
    const view = understoodView(
      {
        q: "balon",
        filters: [],
        price: null,
        sort: "kalkis",
        page: 3,
        dated: { category: "kultur", range: "2026-12-01_2026-12-10", months: null, pax: 1 },
      },
      categories,
      [],
      t
    )
    expect(view?.parts).toEqual([
      {
        label: "Kültür turları",
        path: "/arama?q=balon&tarih=2026-12-01_2026-12-10&sirala=kalkis&_anlam=1",
        remove: "Filtreyi kaldır: Kültür turları",
      },
      {
        label: "1–10 Ara",
        path: "/arama?q=balon&kategori=kultur&sirala=kalkis&_anlam=1",
        remove: "Filtreyi kaldır: 1–10 Ara",
      },
    ])
  })

  it("each month its own chip; a value the page cannot name is left out; none: null", () => {
    const view = understoodView(
      {
        filters: [["renk", ["mavi"]]],
        price: null,
        sort: null,
        page: 1,
        dated: { category: null, range: null, months: "2027-07,2027-08", pax: 1 },
      },
      [],
      [],
      t
    )
    expect(view?.parts.map((part) => [part.label, part.path])).toEqual([
      ["Temmuz 2027", "/arama?renk=mavi&ay=2027-08&_anlam=1"],
      ["Ağustos 2027", "/arama?renk=mavi&ay=2027-07&_anlam=1"],
    ])
    expect(understoodView({ filters: [], price: null, sort: null, page: 1 }, [], [], t)).toBeNull()
  })
})
