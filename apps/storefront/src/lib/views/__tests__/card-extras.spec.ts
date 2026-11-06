import { describe, expect, it } from "vitest"
import type { ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import {
  categoryCard,
  customerPhotos,
  ratingBars,
  reviewPhotos,
  shopMarks,
  withCardFacts,
} from "../card-extras"
import { navigation } from "../categories"
import { mainMenu } from "../menus"

const card = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: null,
  price: { current: "100,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const picture = {
  url: "https://cdn.example.com/kategori.png",
  alt: null,
  width: 64,
  height: 48,
  derivatives: { srcset: { webp: [{ width: 64, url: "https://cdn.example.com/k-64.webp" }] } },
}

// adr/0046 Ek 2026-11-04: the theme contract's optional fields
describe("withCardFacts", () => {
  it("adds the stock bucket and quick add, never the number", () => {
    const [low, out, other] = withCardFacts([card("a"), card("b"), card("c")], {
      a: { stock: "low", quick_add: { variant_id: "variant_a" } },
      b: { stock: "out", quick_add: null },
    })
    expect(low).toMatchObject({ stock: "low", quickAdd: { variantId: "variant_a" } })
    expect(out).toMatchObject({ stock: "out", quickAdd: null })
    // No facts for it (an older backend, a draft): the card as it was
    expect(other).toEqual(card("c"))
  })

  it("gives no quick add to a card without a price or that cannot be bought now", () => {
    const facts = { a: { stock: "in_stock" as const, quick_add: { variant_id: "variant_a" } } }
    expect(withCardFacts([card("a", { price: null })], facts)[0]?.quickAdd).toBeNull()
    expect(withCardFacts([card("a", { available: false })], facts)[0]?.quickAdd).toBeNull()
  })
})

describe("ratingBars", () => {
  it("is 5 to 1 with each share of all, in words for a screen reader", () => {
    const bars = ratingBars({ "5": 6, "4": 3, "3": 1, "2": 0, "1": 0 }, t)
    expect(bars?.map((bar) => [bar.stars, bar.count, bar.percent])).toEqual([
      [5, 6, 60],
      [4, 3, 30],
      [3, 1, 10],
      [2, 0, 0],
      [1, 0, 0],
    ])
    expect(bars?.[0]?.label).toBe("5 yıldız: 6 değerlendirme")
  })

  it("is none without a review or from a backend before it", () => {
    expect(ratingBars({ "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }, t)).toBeNull()
    expect(ratingBars(undefined, t)).toBeNull()
  })
})

describe("category pictures", () => {
  it("puts a picture on a category's card, its name as the alt text, and nothing without one", () => {
    expect(categoryCard({ label: "Mutfak", path: "/kategori/mutfak" }, picture)).toEqual({
      label: "Mutfak",
      path: "/kategori/mutfak",
      image: {
        src: picture.url,
        alt: "Mutfak",
        width: 64,
        height: 48,
        sources: { avif: null, webp: "https://cdn.example.com/k-64.webp 64w" },
      },
    })
    expect(categoryCard({ label: "Bahçe", path: "/kategori/bahce" }, undefined)).toEqual({
      label: "Bahçe",
      path: "/kategori/bahce",
    })
  })

  it("shows them in the category tree menu and on the shop's own menu's category links", () => {
    const pictures = new Map([
      ["pcat_1", picture],
      ["pcat_3", picture],
    ])
    const tree = navigation(
      [
        {
          id: "pcat_1",
          name: "Mutfak",
          handle: "mutfak",
          description: null,
          parent_category_id: null,
        },
        {
          id: "pcat_2",
          name: "Bahçe",
          handle: "bahce",
          description: null,
          parent_category_id: null,
        },
        {
          id: "pcat_3",
          name: "Bıçaklar",
          handle: "bicaklar",
          description: null,
          parent_category_id: "pcat_1",
        },
      ],
      { pcat_1: "/kategori/mutfak", pcat_2: "/kategori/bahce", pcat_3: "/kategori/bicaklar" },
      pictures
    )
    const menu = mainMenu(
      [
        {
          title: "Ana menü",
          location: "main",
          rank: 0,
          items: [
            {
              label: "Mutfak",
              kind: "category",
              target: "pcat_1",
              path: "/mutfak",
              children: [
                {
                  label: "Bıçak",
                  kind: "category",
                  target: "pcat_3",
                  path: "/bicak",
                  children: [],
                },
              ],
            },
            { label: "Blog", kind: "system", target: "blog", path: null, children: [] },
          ],
        },
      ],
      t,
      pictures
    )
    // The tree by name: Bahçe, then Mutfak
    expect(tree.map((each) => each.image?.src ?? null)).toEqual([null, picture.url])
    // A category link carries its picture; a storefront page's link has none
    expect(menu?.map((each) => each.image?.src ?? null)).toEqual([picture.url, null])
    // The children too, for the phone drawer's rows
    expect(tree[1]?.children[0]?.image?.src).toBe(picture.url)
    expect(menu?.[0]?.children[0]?.image?.src).toBe(picture.url)
  })
})

describe("review photos and marks", () => {
  it("names each photo for a screen reader and keeps its size", () => {
    const [photo] = reviewPhotos(
      [{ id: "rvph_1", url: "https://x/1.jpg", width: 800, height: 600 }],
      "Ayşe Y.",
      t
    )
    expect(photo?.image).toEqual({
      src: "https://x/1.jpg",
      alt: "Ayşe Y. adlı müşterinin fotoğrafı 1",
      width: 800,
      height: 600,
      sources: { avif: null, webp: null },
    })
  })

  it("links a customer photo to its product only while the product has a page", () => {
    const photos = customerPhotos(
      [
        {
          id: "rvph_1",
          url: "https://x/1.jpg",
          width: 10,
          height: 10,
          review_id: "prev_1",
          rating: 5,
          author_name: "Ayşe Y.",
          created_at: "2026-11-04T10:00:00Z",
          product: { id: "prod_1", title: "Çakı" },
        },
      ],
      {},
      t
    )
    expect(photos[0]).toMatchObject({ product: null, rating: 5, author: "Ayşe Y." })
  })

  it("writes the ways to pay and carriers in the storefront's words", () => {
    expect(shopMarks(["visa", "bank_transfer", "aras"], t)).toEqual([
      { key: "visa", label: "Visa", logo: { src: "/marks/visa.png", width: 208, height: 68 } },
      { key: "bank_transfer", label: "Havale / EFT", logo: null },
      {
        key: "aras",
        label: "Aras Kargo",
        logo: { src: "/marks/aras.svg", width: 148, height: 40 },
      },
    ])
    expect(shopMarks(undefined, t)).toEqual([])
  })
})
