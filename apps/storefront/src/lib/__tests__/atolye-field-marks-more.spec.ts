import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ImageView, LinkedCategoryCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The editor's field mark on a section's "see all" link (adr/0065 §9, Faz
 * 2b): a product rail's and the categories' link is the shop's own `more`
 * (a field of their forms), so in the editor's preview it carries
 * `data-qf="more"`, wherever the rail draws it (its head, beside its tabs,
 * under a columns rail). The theme's own fallback ("Tüm kategoriler") and
 * the fixed links (posts, reviews, a linked card's own) have no field and
 * stay unmarked. Without the editor's flag nothing is printed.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  sources: { avif: null, webp: null },
})

const product = {
  id: "p1",
  title: "Şam çeliği hançer",
  path: "/urun/hancer",
  brand: null,
  image: picture("hancer"),
  price: { current: "3.850,00 TL", before: null, from: false, discount: null },
  available: true,
}

const own = (label: string) => ({ label, path: `/koleksiyon/${label.toLowerCase()}` })

const rail = (id: string, title: string) => ({
  id,
  type: "products" as const,
  title,
  products: [product],
  more: own(`${title} hepsi`),
  empty: "Yok",
})

const divider = (id: string): HomeSectionView => ({
  id,
  type: "brands",
  title: "Ayraç",
  brands: [{ label: "B", path: "/b" }],
})

const card: LinkedCategoryCardView = {
  label: "Mutfak",
  path: "/kategori/mutfak",
  image: picture("mutfak"),
  children: [{ label: "Tava", path: "/kategori/tava" }],
  all: { label: "Tümünü gör", path: "/kategori/mutfak" },
}

/** Each section this spec looks at, each marked when `editor`. */
function sections(editor: boolean): HomeSectionView[] {
  const flag = editor ? { editor: true as const } : {}
  const list: HomeSectionView[] = [
    rail("tek1", "Tek"),
    divider("ayrac1"),
    // Two rails side by side: a shelf of tabs, each rail's link beside the tab row
    rail("sekme1", "Yeni"),
    rail("sekme2", "Çok satan"),
    divider("ayrac2"),
    {
      ...rail("sutun1", "Sütun"),
      variant: "columns",
      lists: [{ id: "sutun1-1", title: "İkinci", products: [product], at: 0 }],
    },
    {
      id: "kat1",
      type: "categories",
      title: "Reyonlar",
      categories: [card],
      more: own("Reyonlar hepsi"),
    },
    { id: "kat2", type: "categories", title: "Varsayılan", categories: [card] },
    {
      id: "kat3",
      type: "categories",
      title: "Kartlar",
      categories: [card],
      more: own("Kartlar hepsi"),
      variant: "linked",
      linked: { columns: 3, imagePosition: "side", frame: "lined", cards: [card] },
    },
    {
      id: "yazi1",
      type: "posts",
      title: "Yazılar",
      posts: [],
      more: { label: "Tüm yazılar", path: "/blog" },
    },
  ]
  return list.map((section) => ({ ...section, ...flag }))
}

const home = (editor: boolean) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: sections(editor) } })

/** The words of every element marked `more`, in the page's order. */
const marked = (html: string) =>
  [...html.matchAll(/<a [^>]*data-qf="more"[^>]*>([^<]*)</g)].map((match) => match[1])

describe("the see-all link's field mark in Atölye", () => {
  it("prints nothing on a live page", () => {
    const html = home(false)
    expect(html).not.toContain("data-qf")
    // The links themselves are drawn as before
    expect(html).toContain(">Tek hepsi</a>")
    expect(html).toContain(">Reyonlar hepsi</a>")
  })

  it("marks the shop's own link on a rail, beside its tabs, under a columns rail and on categories", () => {
    expect(marked(home(true))).toEqual([
      "Tek hepsi",
      "Yeni hepsi",
      "Çok satan hepsi",
      "Sütun hepsi",
      "Reyonlar hepsi",
      "Kartlar hepsi",
    ])
  })

  it("leaves the theme's own links unmarked: the fallback, a card's, the posts'", () => {
    const html = home(true)
    expect(html).toMatch(/<a href="\/kategoriler" class="[^"]*">Tüm kategoriler<\/a>/)
    expect(html).not.toMatch(/data-qf="[^"]*"[^>]*>Tümünü gör/)
    expect(html).toMatch(/<a href="\/blog" class="[^"]*">Tüm yazılar<\/a>/)
  })
})
