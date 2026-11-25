import { describe, expect, it } from "vitest"
import { SEARCH_FORM_DEFAULTS } from "@qticaret/types/search-form"
import { t } from "@/lib/i18n"
import { NO_DATED } from "../dated-search"
import { EMPTY_VALUES, monthsFrom, searchFormView } from "../search-form"
import type { SearchFormSource } from "../search-form"

const source = (over: Partial<SearchFormSource> = {}): SearchFormSource => ({
  settings: { ...SEARCH_FORM_DEFAULTS, attribute_key: "gidilecek_yer" },
  booking: true,
  categories: [
    { handle: "kultur", name: "Kültür turları" },
    { handle: "doga", name: "Doğa turları" },
  ],
  where: {
    label: "Gidilecek yer",
    options: [
      { value: "kapadokya", label: "Kapadokya" },
      { value: "pamukkale", label: "Pamukkale" },
    ],
  },
  today: "2026-11-23",
  ...over,
})

// adr/0077 §1: the shop's one search box, its fields from the theme setting and the flags
describe("searchFormView", () => {
  it("draws every field of a shop that sells dated products, each with its own name", () => {
    const form = searchFormView(source(), EMPTY_VALUES, t)
    expect(form.action).toBe("/arama")
    expect(form.words).toBeNull()
    expect(form.hidden).toEqual([])
    expect(form.category).toMatchObject({ name: "kategori", style: "select", value: "" })
    expect(form.category?.options.map((option) => option.value)).toEqual(["kultur", "doga"])
    expect(form.where).toMatchObject({ name: "gidilecek_yer", label: "Gidilecek yer", value: "" })
    expect(form.dates?.from).toEqual({
      name: "tarih_baslangic",
      label: "Başlangıç",
      value: "",
      min: "2026-11-23",
      max: "2027-10-31",
    })
    expect(form.dates?.to.name).toBe("tarih_bitis")
    expect(form.dates?.month.name).toBe("ay")
    expect(form.dates?.month.options[0]).toEqual({ value: "2026-11", label: "Kasım 2026" })
    expect(form.dates?.month.options).toHaveLength(12)
    expect(form.people).toMatchObject({ name: "kisi", anyLabel: null, value: "1" })
    expect(form.people?.options).toHaveLength(20)
    expect(form.people?.options[1]).toEqual({ value: "2", label: "2 kişi" })
  })

  it("draws no dates nor party while the shop sells no dated products, whatever the setting", () => {
    const form = searchFormView(source({ booking: false }), EMPTY_VALUES, t)
    expect(form.dates).toBeNull()
    expect(form.people).toBeNull()
    expect(form.category).not.toBeNull()
  })

  it("leaves out each field the shop turns off, and offers the categories as tabs", () => {
    const settings = {
      ...SEARCH_FORM_DEFAULTS,
      attribute_key: "gidilecek_yer",
      show_dates: false,
      show_people: false,
      category_style: "tabs" as const,
    }
    const form = searchFormView(source({ settings }), EMPTY_VALUES, t)
    expect(form.dates).toBeNull()
    expect(form.people).toBeNull()
    expect(form.category?.style).toBe("tabs")
    const none = searchFormView(
      source({ settings: { ...settings, show_category: false } }),
      EMPTY_VALUES,
      t
    )
    expect(none.category).toBeNull()
  })

  it("asks for words when the shop names no attribute or it has no values", () => {
    const plain = searchFormView(
      source({ settings: SEARCH_FORM_DEFAULTS, booking: false, categories: [] }),
      { ...EMPTY_VALUES, q: "çakı" },
      t
    )
    expect(plain.where).toBeNull()
    expect(plain.category).toBeNull()
    expect(plain.words).toMatchObject({ name: "q", value: "çakı" })
    const empty = searchFormView(source({ where: { label: "Yer", options: [] } }), EMPTY_VALUES, t)
    expect(empty.where).toBeNull()
    expect(empty.words).not.toBeNull()
  })

  it("hints the words field with the shop's own line, else the storefront's", () => {
    const own = { ...SEARCH_FORM_DEFAULTS, placeholder: "Nereye gitmek istersiniz?" }
    const hinted = searchFormView(source({ settings: own }), EMPTY_VALUES, t)
    expect(hinted.words?.placeholder).toBe("Nereye gitmek istersiniz?")
    const plain = searchFormView(source({ settings: SEARCH_FORM_DEFAULTS }), EMPTY_VALUES, t)
    expect(plain.words?.placeholder).toBe(t("search.placeholder"))
  })

  it("shows a search's own values chosen, its words carried unseen beside a where field", () => {
    const form = searchFormView(
      source(),
      {
        q: "balon",
        filters: [["gidilecek_yer", ["kapadokya"]]],
        dated: { category: "doga", range: "2026-12-01_2026-12-10", months: null, pax: 3 },
      },
      t
    )
    expect(form.hidden).toEqual([{ name: "q", value: "balon" }])
    expect(form.where?.value).toBe("kapadokya")
    expect(form.category?.value).toBe("doga")
    expect(form.dates?.from.value).toBe("2026-12-01")
    expect(form.dates?.to.value).toBe("2026-12-10")
    expect(form.dates?.month.value).toBe("")
    expect(form.people?.value).toBe("3")
    // A month the box offers, the first of several; a value off its list: none
    const months = searchFormView(
      source(),
      { ...EMPTY_VALUES, dated: { ...NO_DATED, months: "2027-01,2027-02", category: "yok" } },
      t
    )
    expect(months.dates?.month.value).toBe("2027-01")
    expect(months.category?.value).toBe("")
  })

  it("leaves out the flexible month and writes an empty day in words only when the shop asks", () => {
    const plain = searchFormView(source(), EMPTY_VALUES, t).dates
    expect(plain).not.toHaveProperty("flexible")
    expect(plain).not.toHaveProperty("hint")

    const asked = searchFormView(
      source({
        settings: {
          ...SEARCH_FORM_DEFAULTS,
          attribute_key: "gidilecek_yer",
          flexible_month: false,
          date_words: true,
        },
      }),
      EMPTY_VALUES,
      t
    ).dates
    expect(asked?.flexible).toBe(false)
    expect(asked?.hint).toBe("Tarih ekle")
  })

  it("offers this month and the next eleven", () => {
    expect(monthsFrom("2026-11-23")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
    ])
  })
})
