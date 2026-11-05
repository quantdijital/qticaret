import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ActionResult, ImageView, ListingPageView, ProductCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's listing (category, brand, `/magaza`, sale, search):
 * the heavy title with the shop's intro, subcategories as picture tiles,
 * the filters twice (the side panel and the phone's sheet, whose links
 * reopen it), the sort, the filters on as pills, the home page's cards,
 * the pages, and an empty list that offers a way on.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 1000,
  sources: { avif: `/media/${name}-400.avif 400w`, webp: null },
})

const card = (id: string): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: "Atölye",
  image: picture(id),
  price: { current: "1.299,90 TL", before: null, from: false, discount: null },
  available: true,
})

const view = (over: Partial<ListingPageView> = {}): ListingPageView => ({
  title: "Çakılar",
  description: ["El yapımı katlanır çakılar burada."],
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Çakılar", path: null },
  ],
  subcategories: [
    { label: "Katlanır", path: "/kategori/cakilar/katlanir", image: picture("katlanir") },
    { label: "Sabit", path: "/kategori/cakilar/sabit" },
  ],
  products: [{ ...card("a"), quickAdd: { variantId: "v_a" } }, card("b"), card("c")],
  total: 30,
  pagination: {
    page: 2,
    pages: 3,
    previous: "/kategori/cakilar",
    next: "/kategori/cakilar?sayfa=3",
    pagePath: {
      1: "/kategori/cakilar",
      2: "/kategori/cakilar?sayfa=2",
      3: "/kategori/cakilar?sayfa=3",
    },
  },
  sort: [
    { label: "Önerilen", path: "/kategori/cakilar", current: true },
    { label: "Fiyat (artan)", path: "/kategori/cakilar?sirala=fiyat-artan", current: false },
  ],
  filters: [
    {
      key: "marka",
      label: "Marka",
      options: [
        { label: "Atölye", count: 20, selected: true, path: "/kategori/cakilar" },
        { label: "Usta", count: 0, selected: false, path: "/kategori/cakilar?marka=usta" },
      ],
    },
  ],
  price: {
    action: "/kategori/cakilar",
    min: 100,
    max: 4000,
    currentMin: null,
    currentMax: null,
    keep: [{ name: "marka", value: "atolye" }],
  },
  stock: {
    label: "Yalnızca stokta olanlar",
    count: 28,
    selected: false,
    path: "/kategori/cakilar?stok=var",
  },
  active: [{ label: "Atölye", path: "/kategori/cakilar" }],
  clearPath: "/kategori/cakilar",
  ...over,
})

const quickAdd = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })

const page = (over: Partial<ListingPageView> = {}) =>
  renderPage(atolyeTheme, "ListingPage", { view: view(over), quickAdd })

describe("the theme's listing page", () => {
  it("opens with the trail, the one h1 and the shop's intro beside it", () => {
    const html = page()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(">Çakılar</h1>")
    expect(html).toContain("El yapımı katlanır çakılar burada.")
    expect(html).toContain('aria-current="page"')
  })

  it("draws the subcategories as picture tiles, a tile without a picture as its name on graphite", () => {
    const html = page()
    expect(html).toContain('href="/kategori/cakilar/katlanir"')
    expect(html).toContain('src="/media/katlanir.jpg"')
    expect(html).toMatch(/href="\/kategori\/cakilar\/sabit" class="gf-stage[^"]*aspect-\[4\/5\]/)
  })

  it("draws the filters twice: the side panel plainly, the phone's sheet with its own anchor", () => {
    const html = page()
    expect(html).toContain('<dialog id="filtreler"')
    expect(html).toContain('href="/kategori/cakilar?stok=var"')
    expect(html).toContain('href="/kategori/cakilar?stok=var#filtreler"')
    // The price form's fields keep their ids apart
    expect(html).toContain('id="filtre-yan-en-az"')
    expect(html).toContain('id="filtre-sayfa-en-az"')
    expect(html).toContain('action="/kategori/cakilar#filtreler"')
    // A value that would find nothing is shown, never a link
    expect(html).not.toContain('href="/kategori/cakilar?marka=usta')
    expect(html).toContain(">Usta</span>")
  })

  it("puts the count, the sort and the filters on over the grid", () => {
    const html = page()
    expect(html).toContain(">30 ürün</h2>")
    expect(html).toMatch(/href="\/kategori\/cakilar\?sirala=fiyat-artan" rel="nofollow"/)
    expect(html).toContain("Sırala: Önerilen")
    expect(html).toContain('aria-label="Filtreyi kaldır: Atölye"')
    expect(html).toContain(">Tümünü temizle</a>")
    expect(html).toContain("30 ürünü göster")
    expect(html).toContain('href="#filtreler"')
  })

  it("pins the filter and sort pills under the header on a phone, one row of the list's column", () => {
    const html = page()
    expect(html).toMatch(/<div data-gf-stick="" class="[^"]*gf-listbar[^"]*lg:contents/)
    expect(html).toContain("max-lg:contents")
  })

  it("sizes the cards' photos for the grid beside the filters, and for four across without them", () => {
    expect(page()).toContain('sizes="(min-width: 1440px) 325px')
    const wide = page({ filters: [], price: null, stock: null, active: [], clearPath: null })
    expect(wide).toContain('sizes="(min-width: 1440px) 318px')
  })

  it("draws the home page's cards and the pages as links", () => {
    const html = page()
    expect(html).toContain('href="/urun/a"')
    expect(html).toContain('aria-label="Ürün a ürününü sepete ekle"')
    expect(html).toContain('rel="prev"')
    expect(html).toContain('href="/kategori/cakilar?sayfa=3" rel="next"')
    expect(html).toContain("Sayfa 2 / 3")
    expect(html).toMatch(/aria-current="page" aria-label="Sayfa 2"/)
  })

  it("loads the first page's first photos at once", () => {
    const first = page({ pagination: { ...view().pagination, page: 1 } })
    expect(first.match(/fetchPriority="high"/g)).toHaveLength(2)
    expect(page().match(/fetchPriority="high"/g)).toBeNull()
  })

  it("leaves the filters out where the list offers none, four cards across", () => {
    const html = page({ filters: [], price: null, stock: null, active: [], clearPath: null })
    expect(html).not.toContain("<dialog")
    expect(html).toContain("lg:grid-cols-[repeat(4,minmax(0,1fr))]")
  })

  it("narrowed to nothing, says so and offers to clear the filters", () => {
    const html = page({ products: [], total: 0 })
    expect(html).toContain("Bu seçimle eşleşen ürün yok.")
    expect(html).toContain(">Filtreleri temizle</a>")
  })

  it("an empty list says why and leads on to the whole catalogue", () => {
    const html = page({
      products: [],
      total: 0,
      active: [],
      clearPath: null,
      empty: "Şu an indirimde ürün yok.",
    })
    expect(html).toContain("Şu an indirimde ürün yok.")
    expect(html).toContain('href="/magaza"')
    expect(html).not.toContain("<dialog")
  })
})

describe("the theme's search results", () => {
  const help = {
    suggestions: [{ label: "çakı", path: "/arama?q=%C3%A7ak%C4%B1" }],
    categories: [{ label: "Çakılar", path: "/kategori/cakilar", image: picture("cakilar") }],
    brands: [{ label: "Atölye", path: "/arama?q=caki&marka=atolye" }],
  }

  it("offers did-you-mean, the related categories as tiles and the brands as filters", () => {
    const html = page({ title: "“caki” için sonuçlar", description: [], search: help })
    expect(html).toContain("Bunu mu demek istediniz:")
    expect(html).toContain('href="/arama?q=%C3%A7ak%C4%B1"')
    expect(html).toContain(">İlgili kategoriler</h2>")
    expect(html).toContain('src="/media/cakilar.jpg"')
    expect(html).toContain('href="/arama?q=caki&amp;marka=atolye" rel="nofollow"')
    // A search has no subcategories of its own
    expect(html).not.toContain("/kategori/cakilar/katlanir")
  })

  it("stands the brands beside a short row of tiles from 1024 px, under a full one", () => {
    const html = page({ title: "“caki” için sonuçlar", description: [], search: help })
    expect(html).toMatch(/<section aria-labelledby="ilgili-kategoriler" class="[^"]*lg:col-span-1"/)
    expect(html).toMatch(/<section aria-labelledby="ilgili-markalar" class="[^"]*lg:col-span-7"/)
    const many = Array.from({ length: 7 }, (_, index) => ({
      label: `Reyon ${String(index)}`,
      path: `/kategori/reyon-${String(index)}`,
    }))
    const full = page({ description: [], search: { ...help, categories: many } })
    expect(full).not.toMatch(/aria-labelledby="ilgili-markalar" class="[^"]*lg:col-span/)
  })

  it("found nothing: the words, the phrases, the shop's categories as tiles and the catalogue", () => {
    const html = page({
      title: "“zzz” için sonuçlar",
      description: [],
      products: [],
      total: 0,
      filters: [],
      price: null,
      stock: null,
      active: [],
      clearPath: null,
      empty: "“zzz” ile eşleşen ürün bulunamadı.",
      search: {
        ...help,
        popular: [{ label: "Kılıçlar", path: "/kategori/kiliclar", image: picture("kilic") }],
      },
    })
    expect(html).toContain("“zzz” ile eşleşen ürün bulunamadı.")
    expect(html).toContain(">Kategorilere göz atın</h2>")
    expect(html).toContain('src="/media/kilic.jpg"')
    expect(html).toContain('href="/magaza"')
    expect(html).not.toContain(">0 ürün</h2>")
  })

  it("nothing asked yet: the prompt as its words, never twice", () => {
    const html = page({
      title: "Arama",
      description: ["Aradığınız ürünün adını yazın."],
      products: [],
      total: 0,
      filters: [],
      price: null,
      stock: null,
      active: [],
      clearPath: null,
      search: { suggestions: [], categories: [], brands: [] },
    })
    expect(html.match(/Aradığınız ürünün adını yazın\./g)).toHaveLength(1)
  })
})
