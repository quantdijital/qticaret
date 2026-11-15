import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  HomeSectionView,
  ImageView,
  LinkedCategoryCardView,
  ProductCardView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"
import { cardsView } from "../views/category-cards"

/**
 * Cards in a row on a phone (docs/tema/bilesen-denetimi (b) 3): a grid
 * rail's (and the related products', drawn as one) two by default or one,
 * the linked category cards' one by default or two.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 1000,
  sources: { avif: null, webp: `/media/${name}-640.webp 640w` },
})

const product = (id: string): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: picture(id),
  price: { current: "100 TL", before: null, from: false, discount: null },
  available: true,
})

const rail = (more: Partial<Extract<HomeSectionView, { type: "products" }>> = {}) =>
  ({
    id: "yeni",
    type: "products",
    title: "Yeni ürünler",
    products: Array.from({ length: 12 }, (_, index) => product(`p${String(index)}`)),
    more: null,
    empty: "",
    columns: 4,
    ...more,
  }) satisfies HomeSectionView

const card = (name: string): LinkedCategoryCardView => ({
  label: name,
  path: `/kategori/${name.toLowerCase()}`,
  image: picture(name),
  children: [],
  all: null,
})

const linked = (phone?: 1 | 2): HomeSectionView => ({
  id: "reyonlar",
  type: "categories",
  title: "Reyonlar",
  categories: [],
  variant: "linked",
  linked: cardsView(
    {
      columns: 3,
      ...(phone ? { columns_mobile: phone } : {}),
      image_position: "top",
      frame: "lined",
    },
    [card("Mutfak"), card("Bahçe")]
  ),
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

/** Each card's `<li>` classes in the grid, in order. */
const cardClasses = (html: string) =>
  [...html.matchAll(/<li class="([^"]*)"><article/g)].map((match) => match[1])

describe("a grid rail on a phone", () => {
  it("keeps two in a row and six cards by default (the look before the setting)", () => {
    const html = home([rail()])
    expect(html).not.toContain("max-md:grid-cols-")
    expect(html).toContain("30vw, 46vw")
    expect(cardClasses(html).filter((each) => each === "min-w-0")).toHaveLength(6)
  })

  it("stands one in a row when the shop asks, three on a phone and the wider widths as before", () => {
    const html = home([rail({ phoneColumns: 1 })])
    expect(html).toContain("max-md:grid-cols-[minmax(0,1fr)]")
    expect(html).toContain("30vw, 92vw")
    // Eight drawn (two rows of four at 1280 px): a phone three, a tablet six, 1280 px eight
    expect(cardClasses(html)).toEqual([
      "min-w-0",
      "min-w-0",
      "min-w-0",
      "min-w-0 hidden md:block",
      "min-w-0 hidden md:block",
      "min-w-0 hidden md:block",
      "min-w-0 hidden xl:block",
      "min-w-0 hidden xl:block",
    ])
  })
})

describe("the linked category cards on a phone", () => {
  it("stand one in a row by default, two from 640 px", () => {
    const html = home([linked()])
    expect(html).toContain("grid grid-cols-1 sm:grid-cols-2")
    expect(html).toContain("(min-width: 640px) 45vw, 90vw")
  })

  it("stand two in a row on a phone when the shop asks, the photos sized for half", () => {
    const html = home([linked(2)])
    expect(html).toContain("grid grid-cols-2")
    expect(html).not.toContain("grid-cols-1")
    expect(html).toContain("(min-width: 640px) 45vw, 45vw")
    expect(
      cardsView({ columns: 3, image_position: "side", frame: "plain" }, [])
    ).not.toHaveProperty("phoneColumns")
  })
})
