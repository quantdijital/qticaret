import { describe, expect, it } from "vitest"
import { ATOLYE_SOURCE, atolyeCss, declared } from "@/test/atolye-css"
import { readdirSync } from "node:fs"

/**
 * The photo well (adr/0067 S4, step 5a): the ground behind a product's or a
 * category's photograph and a list's thumbnail reads one name, `bg-media`
 * (today's `paper-2`) or `bg-media-deep` (today's `paper-3`), apart from the
 * same tones on boxes, skeletons and empty states. Moving them changed no
 * tone: the names print the old ones.
 */

/** Every theme source file, relative to the theme's `src/`. */
const SOURCES: readonly string[] = readdirSync(ATOLYE_SOURCE, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".tsx") && !file.includes("__tests__"))
  .sort()

/** Each moved well's file and how many wells it holds: [`bg-media`, `bg-media-deep`]. */
const WELLS: Readonly<Record<string, readonly [number, number]>> = {
  "account/Favorites.tsx": [1, 0],
  "account/Orders.tsx": [0, 1],
  "cart/CartLine.tsx": [0, 1],
  "content/PostCard.tsx": [1, 0],
  "content/ReviewsPage.tsx": [1, 1],
  "frame/CartSheetLine.tsx": [0, 1],
  "frame/MenuParts.tsx": [0, 1],
  "frame/QuickViewGallery.tsx": [2, 0],
  "frame/SearchPanel.tsx": [1, 0],
  "order/OrderParts.tsx": [0, 1],
  "parts/CompactCard.tsx": [1, 0],
  "parts/FramedCard.tsx": [1, 0],
  "parts/ProductCard.tsx": [1, 0],
  "payment-link/LinkLines.tsx": [0, 1],
  "product/Gallery.tsx": [1, 0],
  "product/ReviewList.tsx": [1, 0],
  "product/Thumbs.tsx": [1, 0],
  "sections/CategoryCards.tsx": [1, 0],
  "sections/CustomerPhotos.tsx": [1, 0],
  "sections/Guides.tsx": [0, 1],
  "sections/HeroCatalogParts.tsx": [0, 1],
  "sections/PriceBands.tsx": [0, 1],
}

const count = (source: string, pattern: RegExp): number => source.match(pattern)?.length ?? 0
const MEDIA = /\bbg-media(?!-)/g
const DEEP = /\bbg-media-deep\b/g

describe("the photo well's name (adr/0067 S4, step 5a)", () => {
  it("prints today's tones: the card's well paper-2, a row's thumbnail paper-3", () => {
    const tokens = atolyeCss("tokens.css")
    expect(declared(tokens, "--color-media")).toBe("var(--color-paper-2)")
    expect(declared(tokens, "--color-media-deep")).toBe("var(--color-paper-3)")
    // `inline`: the utility prints the tone itself, resolved on the well, so a
    // section that retones the page (look.css, a menu bar) retones it as before
    const block = tokens.slice(tokens.lastIndexOf("@theme"))
    expect(block.startsWith("@theme inline {")).toBe(true)
    expect(block).toContain("--color-media:")
  })

  it("names every photograph's well, and only those", () => {
    const found: Record<string, readonly [number, number]> = {}
    for (const file of SOURCES) {
      const source = atolyeCss(file)
      const wells = [count(source, MEDIA), count(source, DEEP)] as const
      if (wells[0] + wells[1] > 0) {
        found[file] = wells
      }
    }
    expect(found).toEqual(WELLS)
    const total = Object.values(WELLS).reduce((sum, [a, b]) => sum + a + b, 0)
    expect(total).toBe(24)
  })

  it("leaves the same tones on what is not a photograph's ground", () => {
    // Loading skeletons
    expect(atolyeCss("frame/SearchPanel.tsx")).toContain(
      "size-12 shrink-0 rounded-inner bg-paper-2 motion-safe:animate-pulse"
    )
    expect(atolyeCss("frame/QuickViewDialog.tsx")).toContain(
      '"rounded-inner bg-paper-2 motion-safe:animate-pulse"'
    )
    // Empty states: a product without a photograph, an order without pictures
    expect(atolyeCss("product/Gallery.tsx")).toContain(
      "justify-center gap-3 rounded-tile bg-paper-2 text-sm text-text-2"
    )
    expect(atolyeCss("account/Orders.tsx")).toContain(
      '"flex shrink-0 items-center justify-center bg-paper-3"'
    )
    // Boxes around the wells, a person's picture, a graphite stage's well
    expect(atolyeCss("sections/Guides.tsx")).toContain(
      "flex-col overflow-hidden rounded-tile bg-paper-2"
    )
    expect(atolyeCss("content/GoogleReviews.tsx")).toContain("rounded-full bg-paper-3 object-cover")
    expect(atolyeCss("sections/Spotlight.tsx")).toContain(
      "overflow-hidden rounded-media bg-stage-2"
    )
    // The katalog list's thumbnail takes its ground from the name, not the stylesheet
    expect(atolyeCss("catalog.css")).not.toMatch(/\.gf-mosaic-thumb \{[^}]*background/)
  })

  it("keeps a well's controls answering the pointer one step darker, as on paper-2", () => {
    expect(atolyeCss("buy.css")).toContain(":is(.bg-paper-2, .bg-media) .gf-icon-btn:hover")
  })
})
