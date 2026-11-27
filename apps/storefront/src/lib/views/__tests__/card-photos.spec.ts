import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { productCard } from "../product"
import type { CardOptions } from "../product"

const photos = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `img_${String(index)}`,
    url: `https://cdn.example/${String(index)}.jpg`,
    // Out of order on purpose: the card reads them by rank
    rank: count - index,
  }))

const product = (count: number): StoreProduct => ({
  id: "prod_1",
  title: "Kapadokya",
  handle: "kapadokya",
  subtitle: null,
  description: null,
  thumbnail: null,
  images: photos(count),
  variants: [],
})

const CYCLE: CardOptions = {
  showBrand: true,
  showRating: false,
  hoverImage: true,
  hoverCycle: true,
}

const card = (count: number, options: CardOptions = CYCLE) =>
  productCard(product(count), "/urun/kapadokya", {}, options)

/** sahip 2026-11-26: every photo in turn under a resting mouse (`hover_cycle`). */
describe("a card's photos after the second", () => {
  it("carries them in rank order, five photos in all at most", () => {
    const view = card(7)
    expect(view.image?.src).toBe("https://cdn.example/6.jpg")
    expect(view.secondImage?.src).toBe("https://cdn.example/5.jpg")
    expect(view.morePhotos?.map((photo) => photo.src)).toEqual([
      "https://cdn.example/4.jpg",
      "https://cdn.example/3.jpg",
      "https://cdn.example/2.jpg",
    ])
  })

  it("carries none with the cycle off, the second photo off, or two photos or fewer", () => {
    expect(card(5, { ...CYCLE, hoverCycle: false })).not.toHaveProperty("morePhotos")
    expect(card(5, { ...CYCLE, hoverImage: false })).not.toHaveProperty("morePhotos")
    expect(card(2)).not.toHaveProperty("morePhotos")
    expect(card(5, { showBrand: true, showRating: false })).not.toHaveProperty("morePhotos")
  })
})
