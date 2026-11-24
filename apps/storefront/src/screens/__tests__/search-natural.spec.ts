import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// `/arama` in the shopper's own words (adr/0077 §7): read once into filters, else searched as typed

const api = vi.hoisted(() => ({
  searchPage: vi.fn(),
  allCategories: vi.fn(),
  pathsOf: vi.fn(),
  categoryTiles: vi.fn(),
  currentSearchForm: vi.fn(),
  naturalSearchOn: vi.fn(),
  interpretSentence: vi.fn(),
}))
vi.mock("@/lib/store-api/listings", () => ({ searchPage: api.searchPage }))
vi.mock("@/lib/store-api/requests", () => ({
  allCategories: api.allCategories,
  pathsOf: api.pathsOf,
}))
vi.mock("@/lib/store-api/search-interpret", () => ({ interpretSentence: api.interpretSentence }))
vi.mock("@/lib/views/category-tiles", () => ({ categoryTiles: api.categoryTiles }))
vi.mock("@/lib/views/search-form-data", () => ({ currentSearchForm: api.currentSearchForm }))
vi.mock("@/lib/views/natural-search-on", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  naturalSearchOn: api.naturalSearchOn,
}))
vi.mock("@/theme", () => ({ theme: { ListingPage: () => null } }))
vi.mock("../listing", () => ({ ListingContent: () => null }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`)
  },
  permanentRedirect: (path: string) => {
    throw new Error(`MOVED ${path}`)
  },
}))

const { SearchScreen } = await import("../search")

const FORM = {
  action: "/arama",
  label: "Ürün ara",
  words: { name: "q", label: "Ne arıyorsunuz?", placeholder: "", value: "" },
}
const HINT =
  "Aradığınızı kendi cümlenizle de yazabilirsiniz. Kişisel bilgi (ad, telefon, adres) yazmayın."

const answer = () => ({
  product_ids: ["prod_1"],
  count: 1,
  page: 1,
  page_size: 24,
  facets: {
    brands: [],
    attributes: [
      {
        key: "gidilecek_yer",
        label: "Gidilecek yer",
        values: [{ value: "kapadokya", label: "Kapadokya", count: 1, selected: true }],
      },
    ],
    price: null,
  },
})

const SENTENCE = "ağustosta iki kişi kapadokya"

type Props = Record<string, unknown> & { extra: Record<string, unknown> }
const screen = async (query: Record<string, string>) =>
  (await SearchScreen({ query })) as ReactElement<Props>

beforeEach(() => {
  vi.clearAllMocks()
  api.allCategories.mockResolvedValue([
    { id: "pcat_1", handle: "kultur", name: "Kültür turları", parent_category_id: null },
  ])
  api.pathsOf.mockResolvedValue({})
  api.categoryTiles.mockResolvedValue([])
  api.currentSearchForm.mockResolvedValue(FORM)
  api.searchPage.mockResolvedValue(answer())
  api.naturalSearchOn.mockResolvedValue(true)
})

describe("SearchScreen in the shopper's own words", () => {
  it("off: the sentence is searched as typed, never sent, no hint", async () => {
    api.naturalSearchOn.mockResolvedValue(false)

    const page = await screen({ q: SENTENCE })

    expect(api.interpretSentence).not.toHaveBeenCalled()
    expect(api.searchPage).toHaveBeenCalledWith(SENTENCE, "")
    expect(page.props.extra["searchHint"]).toBeNull()
    expect(page.props.extra["understood"]).toBeNull()
  })

  it("on: a sentence read into filters moves once (307) to them, marked", async () => {
    api.interpretSentence.mockResolvedValue({
      query: "gidilecek_yer=kapadokya&ay=2027-08&kisi=2",
      understood: [
        { kind: "nitelik", label: "Kapadokya", param: "gidilecek_yer", value: "kapadokya" },
        { kind: "ay", label: "Ağustos 2027", param: "ay", value: "2027-08" },
        { kind: "kisi", label: "2", param: "kisi", value: "2" },
      ],
      dropped: [],
    })

    await expect(screen({ q: SENTENCE })).rejects.toThrow(
      "REDIRECT /arama?gidilecek_yer=kapadokya&ay=2027-08&kisi=2&_anlam=1"
    )
    expect(api.interpretSentence).toHaveBeenCalledWith(SENTENCE)
    expect(api.searchPage).not.toHaveBeenCalled()
  })

  it("the marked address: the backend never sees the mark, the parts read show as chips", async () => {
    const page = await screen({
      gidilecek_yer: "kapadokya",
      ay: "2027-08",
      kisi: "2",
      _anlam: "1",
    })

    expect(api.interpretSentence).not.toHaveBeenCalled()
    expect(api.searchPage).toHaveBeenCalledWith(null, "gidilecek_yer=kapadokya&ay=2027-08&kisi=2")
    expect(page.props.extra["searchHint"]).toBe(HINT)
    expect(page.props.extra["understood"]).toEqual({
      title: "Anladığım:",
      parts: [
        {
          label: "Kapadokya",
          path: "/arama?ay=2027-08&kisi=2&_anlam=1",
          remove: "Filtreyi kaldır: Kapadokya",
        },
        {
          label: "Ağustos 2027",
          path: "/arama?gidilecek_yer=kapadokya&kisi=2&_anlam=1",
          remove: "Filtreyi kaldır: Ağustos 2027",
        },
        {
          label: "2 kişi",
          path: "/arama?gidilecek_yer=kapadokya&ay=2027-08&_anlam=1",
          remove: "Filtreyi kaldır: 2 kişi",
        },
      ],
    })
  })

  it("a failed reading (429, 404, down) or the words as they are: the plain search", async () => {
    api.interpretSentence.mockResolvedValue(null)
    const failed = await screen({ q: SENTENCE })
    expect(api.searchPage).toHaveBeenLastCalledWith(SENTENCE, "")
    expect(failed.props.extra["understood"]).toBeNull()
    expect(failed.props.extra["searchHint"]).toBe(HINT)

    api.interpretSentence.mockResolvedValue({
      query: `q=${encodeURIComponent(SENTENCE)}`,
      understood: [],
      dropped: [],
      fallback: true,
    })
    await screen({ q: SENTENCE })
    expect(api.searchPage).toHaveBeenLastCalledWith(SENTENCE, "")
  })

  it("a product's name, or words beside the box's own choices, are not sent", async () => {
    await screen({ q: "kamp bıçağı" })
    await screen({ q: SENTENCE, kategori: "kultur" })
    expect(api.interpretSentence).not.toHaveBeenCalled()
  })

  it("no hint under a box without a words field", async () => {
    api.currentSearchForm.mockResolvedValue({ ...FORM, words: null })
    const page = await screen({ q: "çakı" })
    expect(page.props.extra["searchHint"]).toBeNull()
  })
})
