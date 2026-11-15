import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { FEATURED_PRODUCT_DEFAULTS } from "@qticaret/types"
import type { FeaturedProductSettings } from "@qticaret/types"
import type { HomeSectionView, ImageView, ProductCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The featured product's photographs layout (adr/0049 Ek 2026-11-15):
 * `collage`, the drawing from before the setting, stays exactly as it was
 * (the preset lock holds its HTML too); `strips` sets up to four
 * photographs side by side as slanted strips (`parts/Strips.tsx`, whose
 * own drawing `atolye-strips.spec.tsx` holds), each a link to the product.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: `Şef bıçağı ${name}`,
  width: 800,
  height: 800,
  // `sizes` is printed on the picture's sources
  sources: { avif: null, webp: `/media/${name}-800.webp 800w` },
})

const card: ProductCardView = {
  id: "prod_1",
  title: "Şef Bıçağı",
  path: "/urun/sef-bicagi",
  brand: null,
  image: picture("kart"),
  price: { current: "1.749,00 TL", before: null, from: false, discount: null },
  available: true,
}

type Featured = Extract<HomeSectionView, { type: "featured_product" }>

const featured = (over: Partial<Featured> = {}): Featured => ({
  id: "yakin",
  type: "featured_product",
  title: null,
  text: "Mutfağın en çok kullanılanı.",
  product: card,
  subtitle: null,
  images: ["bir", "iki", "uc", "dort", "bes", "alti"].map(picture),
  facts: [],
  specGroups: [],
  ...over,
})

const home = (section: Featured) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: [section] } })

const strips = (
  images: ImageView[],
  product: ProductCardView = card,
  look: Partial<FeaturedProductSettings> = {}
) =>
  home(
    featured({
      images,
      product,
      settings: { ...FEATURED_PRODUCT_DEFAULTS, gallery: "strips", ...look },
    })
  )

const count = (html: string, needle: string) => html.split(needle).length - 1

describe("the featured product's collage (the default)", () => {
  it("draws the same HTML with no setting, the collage's or an unknown one", () => {
    const before = home(featured())
    expect(home(featured({ settings: FEATURED_PRODUCT_DEFAULTS }))).toBe(before)
    expect(
      home(featured({ settings: { gallery: "mosaic" } as unknown as FeaturedProductSettings }))
    ).toBe(before)
    expect(before).not.toContain("gf-strip")
    // One large and two small beside it, as before the setting
    expect(before).toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]")
    expect(count(before, "<img")).toBe(3)
  })
})

describe("the featured product's slanted strips", () => {
  it("shows at most four photographs as strips, each a link to the product's page", () => {
    const html = strips(["bir", "iki", "uc", "dort", "bes", "alti"].map(picture))
    expect(html).toContain('data-count="4"')
    expect(count(html, '<li class="gf-strip">')).toBe(4)
    expect(count(html, '<a href="/urun/sef-bicagi" class="gf-strip-cut">')).toBe(4)
    expect(html).toContain('alt="Şef bıçağı dort"')
    expect(html).not.toContain('alt="Şef bıçağı bes"')
    // The gallery's fixed proportions (no layout shift) on the stage's own photo well
    expect(html).toMatch(
      /class="gf-strips rounded-media aspect-square lg:col-span-7 lg:aspect-\[4\/3\]"/
    )
    expect(html).not.toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]")
    // No words over the photographs: the name stands beside them
    expect(html).not.toContain("gf-strip-text")
  })

  it("asks for an image as wide as a widened strip, and a phone's equal share", () => {
    const before = { strips_slant: "soft", strips_line: "medium" } as const
    const html = strips(["bir", "iki", "uc", "dort"].map(picture), card, before)
    // 53vw × 2.75 / (2.75 + 3) from 1024 px; a quarter of a tablet's screen, a third of a phone's
    expect(html).toContain('sizes="(min-width: 1024px) 26vw, (min-width: 640px) 25vw, 34vw"')
    // Three: 53vw × 2.75 / (2.75 + 2); a third below 1024 px
    expect(strips(["bir", "iki", "uc"].map(picture), card, before)).toContain(
      'sizes="(min-width: 1024px) 31vw, 34vw"'
    )
    // The default's steeper seams widen the strips' sum: a larger image
    expect(strips(["bir", "iki", "uc"].map(picture))).toContain(
      'sizes="(min-width: 1024px) 37vw, 34vw"'
    )
  })

  it("draws one photograph as one straight strip, two and three as equal strips", () => {
    const one = strips([picture("bir")])
    expect(one).toContain('data-count="1"')
    expect(count(one, '<li class="gf-strip">')).toBe(1)
    expect(one).toContain('sizes="(min-width: 1024px) 53vw, 100vw"')
    expect(strips(["bir", "iki"].map(picture))).toContain('data-count="2"')
    expect(strips(["bir", "iki", "uc"].map(picture))).toContain('data-count="3"')
  })

  it("takes the card's picture when the product has no others, and draws none without one", () => {
    expect(strips([])).toContain('data-count="1"')
    const bare = strips([], { ...card, image: null })
    expect(bare).not.toContain("gf-strip")
    expect(bare).not.toContain("<img")
    expect(bare).toContain("Mutfağın en çok kullanılanı.")
  })
})

const SIX = ["bir", "iki", "uc", "dort", "bes", "alti"].map(picture)
const rootOf = (html: string) => /<ul class="gf-strips[^>]*>/.exec(html)?.[0] ?? ""

describe("the strips' look (adr/0049 Ek 2026-11-16)", () => {
  it("draws the bolder default: steeper seams, a thin line, the others darkening", () => {
    expect(rootOf(strips(SIX))).toBe(
      '<ul class="gf-strips rounded-media aspect-square lg:col-span-7 lg:aspect-[4/3]" data-count="4" data-slant="medium" data-line="thin" data-dim="on">'
    )
  })

  it("prints the drawing from before as no attribute, each other step as its own", () => {
    const before = {
      strips_slant: "soft",
      strips_line: "medium",
      strips_overlap: "off",
      strips_dim: "off",
    } as const
    expect(rootOf(strips(SIX, card, before))).toMatch(/lg:aspect-\[4\/3\]" data-count="4">$/)
    const bold = { strips_slant: "steep", strips_line: "none", strips_overlap: "on" } as const
    expect(rootOf(strips(SIX, card, bold))).toContain(
      'data-slant="steep" data-line="none" data-overlap="on" data-dim="on"'
    )
  })

  it("runs six strips across the stage when wide, the words under them in two columns", () => {
    const html = strips(SIX, card, { strips_layout: "wide" })
    expect(rootOf(html)).toContain(
      'class="gf-strips rounded-media aspect-square sm:aspect-[16/9] lg:col-span-12 lg:aspect-[21/9]" data-count="6"'
    )
    expect(html).toContain('alt="Şef bıçağı alti"')
    // 92vw of the screen from 1024 px, a widened strip of six
    expect(html).toContain('sizes="(min-width: 1024px) 48vw, (min-width: 640px) 25vw, 34vw"')
    expect(html).toMatch(
      /<div class="grid gap-5 [^"]*lg:col-span-12 lg:grid-cols-12[^"]*"><div class="flex flex-col gap-4 lg:col-span-7"><h2/
    )
    expect(html).toMatch(/<div class="flex flex-col gap-5 lg:col-span-5">[\s\S]*Sepete|Ürünü/)
    expect(html).not.toContain("lg:col-span-5 lg:px-8 lg:py-10")
  })

  it("leaves the collage as it was whatever the strips' look says", () => {
    const before = home(featured())
    const look = {
      ...FEATURED_PRODUCT_DEFAULTS,
      strips_layout: "wide",
      strips_slant: "steep",
      strips_overlap: "on",
    } as const
    expect(home(featured({ settings: look }))).toBe(before)
  })
})
