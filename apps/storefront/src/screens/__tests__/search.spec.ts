import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// `/arama` (adr/0077 §1–§2): a date search without words, its title, the box over it, its moves

const api = vi.hoisted(() => ({
  searchPage: vi.fn(),
  allCategories: vi.fn(),
  pathsOf: vi.fn(),
  categoryTiles: vi.fn(),
  currentSearchForm: vi.fn(),
}))
vi.mock("@/lib/store-api/listings", () => ({ searchPage: api.searchPage }))
vi.mock("@/lib/store-api/requests", () => ({
  allCategories: api.allCategories,
  pathsOf: api.pathsOf,
}))
vi.mock("@/lib/views/category-tiles", () => ({ categoryTiles: api.categoryTiles }))
vi.mock("@/lib/views/search-form-data", () => ({ currentSearchForm: api.currentSearchForm }))
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

const FORM = { action: "/arama", label: "Ürün ara" }

const answer = (over: Record<string, unknown> = {}) => ({
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
  ...over,
})

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
})

describe("SearchScreen", () => {
  it("answers a date search without words, titled by what it asks, its cards told the dates", async () => {
    api.searchPage.mockResolvedValue(answer())

    const page = await screen({
      kategori: "kultur",
      tarih: "2026-12-01_2026-12-10",
      kisi: "2",
      gidilecek_yer: "kapadokya",
    })

    expect(api.searchPage).toHaveBeenCalledWith(
      null,
      "kategori=kultur&tarih=2026-12-01_2026-12-10&kisi=2&gidilecek_yer=kapadokya"
    )
    const heading = await (page.props["heading"] as () => Promise<{ title: string }>)()
    expect(heading.title).toBe("Kültür turları · Kapadokya · 1–10 Ara · 2 kişi")
    expect(page.props["cardDates"]).toEqual({ from: "2026-12-01", to: "2026-12-10", pax: 2 })
    expect(page.props.extra["searchForm"]).toBe(FORM)
    expect(page.props.extra["empty"]).toBe(
      "Bu seçimlere uyan ürün bulunamadı. Tarihleri ya da seçimleri değiştirip yeniden deneyin."
    )
    // The box shows the search's own values
    expect(api.currentSearchForm).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "",
        filters: [["gidilecek_yer", ["kapadokya"]]],
        dated: { category: "kultur", range: "2026-12-01_2026-12-10", months: null, pax: 2 },
      }),
      expect.any(Function)
    )
  })

  it("moves once (301) to the canonical query the backend gives, the words first", async () => {
    api.searchPage.mockResolvedValue(
      answer({ canonical_query: "kategori=kultur&tarih=2026-12-01_2026-12-10" })
    )

    await expect(
      screen({ q: "balon", tarih: "2026-12-01_2026-12-10", ay: "2027-01", kategori: "kultur" })
    ).rejects.toThrow("MOVED /arama?q=balon&kategori=kultur&tarih=2026-12-01_2026-12-10")
  })

  it("moves the box's GET form to its clean address before asking anything", async () => {
    await expect(
      screen({
        q: "",
        kategori: "",
        tarih_baslangic: "2026-12-10",
        tarih_bitis: "2026-12-01",
        ay: "",
        kisi: "1",
        gidilecek_yer: "kapadokya",
      })
    ).rejects.toThrow("REDIRECT /arama?gidilecek_yer=kapadokya&tarih=2026-12-01_2026-12-10")
    expect(api.searchPage).not.toHaveBeenCalled()
  })

  it("offers the box over the shop's categories when nothing is asked", async () => {
    const page = await screen({})

    expect(api.searchPage).not.toHaveBeenCalled()
    expect(page.props["title"]).toBe("Arama")
    expect(page.props["words"]).toBe("Aradığınız ürünün adını yukarıdaki kutuya yazın.")
    expect(page.props["form"]).toBe(FORM)
  })

  it("keeps a words search as it was, the box beside it", async () => {
    api.searchPage.mockResolvedValue(answer())

    const page = await screen({ q: "çakı" })

    expect(api.searchPage).toHaveBeenCalledWith("çakı", "")
    const heading = await (page.props["heading"] as () => Promise<{ title: string }>)()
    expect(heading.title).toBe("“çakı” için sonuçlar")
    expect(page.props["cardDates"]).toBeNull()
    expect(page.props.extra["empty"]).toBe(
      "“çakı” ile eşleşen ürün bulunamadı. Başka bir kelimeyle deneyin."
    )
  })
})
