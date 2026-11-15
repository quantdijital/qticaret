import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { FeaturedProductSettings } from "@qticaret/types"
import type { HomeSectionView, ImageView, ProductCardView } from "@qticaret/ui"
import { buildAtolyeCss } from "@/test/tailwind-build"
import { renderPage } from "@/test/theme-render"

/**
 * The featured product's photographs layout (adr/0049 Ek 2026-11-15):
 * `collage`, the drawing from before the setting, stays exactly as it was
 * (the preset lock holds its HTML too); `strips` sets up to four
 * photographs side by side as equal slanted strips that widen under the
 * pointer or the keyboard's focus from 1024 px, CSS only.
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

const strips = (images: ImageView[], product: ProductCardView = card) =>
  home(featured({ images, product, settings: { gallery: "strips" } }))

const count = (html: string, needle: string) => html.split(needle).length - 1

describe("the featured product's collage (the default)", () => {
  it("draws the same HTML with no setting, the collage's or an unknown one", () => {
    const before = home(featured())
    expect(home(featured({ settings: { gallery: "collage" } }))).toBe(before)
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
  it("shows at most four photographs as equal strips, each a link to the product's page", () => {
    const html = strips(["bir", "iki", "uc", "dort", "bes", "alti"].map(picture))
    expect(html).toContain('data-count="4"')
    expect(html).toContain('data-gallery="strips"')
    expect(count(html, 'class="gf-strip bg-stage-2"')).toBe(4)
    expect(count(html, '<a href="/urun/sef-bicagi" class="gf-strip-link">')).toBe(4)
    expect(html).toContain('alt="Şef bıçağı dort"')
    expect(html).not.toContain('alt="Şef bıçağı bes"')
    // The gallery's fixed proportions (no layout shift) on the stage's own photo well
    expect(html).toMatch(
      /class="gf-strips rounded-media aspect-square lg:col-span-7 lg:aspect-\[4\/3\]"/
    )
    expect(html).not.toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]")
  })

  it("asks for an image as wide as a widened strip, and a phone's equal share", () => {
    const html = strips(["bir", "iki", "uc", "dort"].map(picture))
    // 53vw × 2.75 / (2.75 + 3) from 1024 px; a quarter of a tablet's screen, a third of a phone's
    expect(html).toContain('sizes="(min-width: 1024px) 26vw, (min-width: 640px) 25vw, 34vw"')
    // Three: 53vw × 2.75 / (2.75 + 2); a third below 1024 px
    expect(strips(["bir", "iki", "uc"].map(picture))).toContain(
      'sizes="(min-width: 1024px) 31vw, 34vw"'
    )
  })

  it("draws one photograph as one straight strip, two and three as equal strips", () => {
    const one = strips([picture("bir")])
    expect(one).toContain('data-count="1"')
    expect(count(one, 'class="gf-strip bg-stage-2"')).toBe(1)
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

/** Every rule written for `selector`, with the at-rules around it, in the built stylesheet. */
function rules(css: string, selector: string): { around: string[]; body: string }[] {
  const found: { around: string[]; body: string }[] = []
  let from = 0
  for (;;) {
    const at = css.indexOf(`${selector} {`, from)
    if (at < 0) return found
    from = at + selector.length
    if (!/\s/.test(css[at - 1] ?? "\n")) continue
    const around: string[] = []
    let head = 0
    for (let index = 0; index < at; index++) {
      const char = css[index]
      if (char === "{") {
        around.push(css.slice(head, index).trim())
        head = index + 1
      } else if (char === "}") {
        around.pop()
        head = index + 1
      } else if (char === ";") {
        head = index + 1
      }
    }
    const open = css.indexOf("{", at)
    found.push({ around, body: css.slice(open + 1, css.indexOf("}", open)).trim() })
  }
}

describe("the strips' stylesheet", () => {
  it("widens a strip under a hovering pointer only from 1024 px, in one ease-out slide", async () => {
    const css = await buildAtolyeCss([])
    const [hover] = rules(css, ".gf-strip:hover")
    expect(hover?.around).toEqual([
      "@layer components",
      "@media (min-width: 64rem) and (hover: hover) and (pointer: fine)",
    ])
    expect(hover?.body).toBe("flex-grow: var(--strip-grow);")
    const moving = rules(css, ".gf-strip").find((rule) => rule.body.startsWith("transition"))
    expect(moving?.around).toEqual(["@layer components", "@media (min-width: 64rem)"])
    expect(moving?.body).toBe("transition: flex-grow var(--dur-long) var(--ease-out);")
  })

  it("widens the strip holding the keyboard's focus alike, and keeps its ring inside the clip", async () => {
    const css = await buildAtolyeCss([])
    const [focus] = rules(css, ".gf-strip:has(.gf-strip-link:focus-visible)")
    expect(focus?.around).toEqual(["@layer components", "@media (min-width: 64rem)"])
    expect(focus?.body).toBe("flex-grow: var(--strip-grow);")
    // The ring is a layer over the photograph (the link's outline lies under it), clear of the seams
    expect(rules(css, ".gf-strip-link:focus-visible")[0]?.body).toBe("outline: none;")
    const ring = rules(css, ".gf-strip-link:focus-visible::after")[0]?.body
    expect(ring).toContain("position: absolute;")
    expect(ring).toContain("inset: 4px calc(var(--strip-slant) + 4px);")
    expect(ring).toContain("outline: 2px solid var(--color-focus);")
  })

  it("shows three strips on a phone's width, the third then ending the gallery straight", async () => {
    const css = await buildAtolyeCss([])
    const [hidden] = rules(css, ".gf-strip:nth-child(n + 4)")
    expect(hidden?.around).toEqual(["@layer components", "@media (max-width: 39.99rem)"])
    expect(hidden?.body).toBe("display: none;")
    expect(rules(css, '.gf-strips[data-count="4"] .gf-strip:nth-child(3)')[0]?.body).toBe(
      "clip-path: polygon(var(--strip-slant) 0, 100% 0, 100% 100%, 0 100%);"
    )
  })

  it("snaps at once under reduced motion", async () => {
    const css = await buildAtolyeCss([])
    const still = rules(css, ".gf-strip").find((rule) =>
      rule.around.includes("@media (prefers-reduced-motion: reduce)")
    )
    expect(still?.body).toBe("transition: none;")
  })

  it("slants every seam by one run, the outer edges and a lone strip straight", async () => {
    const css = await buildAtolyeCss([])
    const [strip] = rules(css, ".gf-strip")
    expect(strip?.body).toContain("flex: 1 1 0;")
    expect(strip?.body).toMatch(/clip-path: polygon\(\s*var\(--strip-slant\) 0,/)
    expect(rules(css, ".gf-strip:first-child")[0]?.body).toContain("polygon(0 0, 100% 0,")
    expect(rules(css, ".gf-strip:last-child")[0]?.body).toContain("100% 100%, 0 100%)")
    expect(rules(css, ".gf-strip:only-child")[0]?.body).toBe("clip-path: none;")
    expect(rules(css, ".gf-strip + .gf-strip")[0]?.body).toBe(
      "margin-left: calc(var(--strip-gap) - var(--strip-slant));"
    )
    // A theme token each, the run smaller on a phone
    const [gallery, wide] = rules(css, ".gf-strips")
    expect(gallery?.body).toContain("--strip-slant: var(--space-xs);")
    expect(gallery?.body).toContain("--strip-gap: var(--space-sm);")
    expect(wide?.body).toContain("--strip-slant: var(--space-lg);")
  })

  it("prints the gallery's proportions the strips use", async () => {
    const css = await buildAtolyeCss(["aspect-square", "lg:aspect-[4/3]"])
    expect(css).toContain("aspect-ratio: 4/3;")
  })
})
