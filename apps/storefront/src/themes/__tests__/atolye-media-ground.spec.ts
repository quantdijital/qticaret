import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { DEFAULT_THEME, themeView } from "@/lib/views/theme"
import { ATOLYE_SOURCE, atolyeCss, declared, ruleBody } from "@/test/atolye-css"
import { renderFrame, shopFixture } from "@/test/theme-render"
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
  "frame/NewsletterBox.tsx": [1, 0],
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
  "sections/CategoryCollage.tsx": [1, 0],
  // adr/0077 §10 Ek: a category's picture in its disc
  "sections/CategoryIcons.tsx": [1, 0],
  "sections/CustomerPhotos.tsx": [1, 0],
  "sections/Guides.tsx": [0, 1],
  "sections/HeroCatalogParts.tsx": [0, 1],
  "sections/PriceBands.tsx": [0, 1],
  "sections/ShelfStage.tsx": [2, 0],
  // adr/0073 §3: "Görselli metin"'s picture
  "sections/Story.tsx": [1, 0],
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
    expect(total).toBe(30)
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
      "flex-col overflow-hidden rounded-tile gf-pane"
    )
    expect(atolyeCss("content/GoogleReviews.tsx")).toContain("rounded-full bg-paper-3 object-cover")
    expect(atolyeCss("sections/Spotlight.tsx")).toContain(
      "overflow-hidden rounded-media bg-stage-2"
    )
    // The katalog list's thumbnail takes its ground from the name, not the stylesheet
    expect(atolyeCss("catalog.css")).not.toMatch(/\.gf-mosaic-thumb \{[^}]*background/)
  })

  it("keeps a well's controls answering the pointer one step darker, as on paper-2", () => {
    expect(atolyeCss("buy.css")).toContain(
      ":is(.bg-paper-2, .gf-pane, .bg-media) .gf-icon-btn:hover"
    )
  })
})

describe("the photo ground's page step (adr/0067 S4, step 5b)", () => {
  const media = atolyeCss("media.css")
  const PAGE = '[data-media-ground="page"] :is(.bg-media, .bg-media-deep)'
  const IN_BOX =
    '[data-media-ground="page"] :is(.bg-field, .gf-drop, .gf-suggest) :is(.bg-media, .bg-media-deep)'
  const SUBTILE = '[data-media-ground="page"][data-surface="lined"] .gf-subtile img'

  it("draws the well in the ground it sits on: the page, or the field in a white box", () => {
    expect(ruleBody(media, PAGE)).toContain("background-color: var(--color-paper);")
    expect(ruleBody(media, IN_BOX)).toContain("background-color: var(--color-field);")
    expect(ruleBody(media, SUBTILE)).toContain("background: var(--color-paper);")
  })

  // A well in a box of adr/0067 step 4 (the order's lines, the payment link's rows)
  const WELL = ":is(.bg-media, .bg-media-deep)"
  const IN_PANE = `[data-media-ground="page"] .gf-pane ${WELL}`
  const IN_PANE_INNER = `[data-media-ground="page"] .gf-pane-inner ${WELL}`
  const IN_PANE_LINED = `[data-media-ground="page"][data-surface="lined"] .gf-pane ${WELL}`
  const IN_PANE_INNER_LINED = `[data-media-ground="page"][data-surface="lined"] .gf-pane-inner ${WELL}`

  it("draws a well in a box in the box's ground, at both surface steps", () => {
    // `filled`: the box's tone, the inner box's field (surface.css)
    expect(ruleBody(media, IN_PANE)).toContain("background-color: var(--color-paper-2);")
    expect(ruleBody(media, IN_PANE_INNER)).toContain("background-color: var(--color-field);")
    // `lined`: the ruled box stands on the page's paper, the box inside it on the tone
    expect(ruleBody(media, IN_PANE_LINED)).toContain("background-color: var(--color-paper);")
    expect(ruleBody(media, IN_PANE_INNER_LINED)).toContain(
      "background-color: var(--color-paper-2);"
    )
    const surface = atolyeCss("surface.css")
    expect(ruleBody(surface, ".gf-pane")).toContain("var(--color-paper-2)")
    expect(ruleBody(surface, ".gf-pane-inner")).toContain("var(--color-field)")
    expect(ruleBody(surface, '[data-surface="lined"] .gf-pane')).toContain("var(--color-paper)")
    expect(ruleBody(surface, '[data-surface="lined"] .gf-pane-inner')).toContain(
      "var(--color-paper-2)"
    )
  })

  it("lets the nearer box win: the inner box after the box, the lined step after filled", () => {
    const at = (selector: string) => media.indexOf(`${selector} {`)
    expect(at(PAGE)).toBeLessThan(at(IN_PANE))
    expect(at(IN_PANE)).toBeLessThan(at(IN_PANE_INNER))
    expect(at(IN_PANE_INNER)).toBeLessThan(at(IN_PANE_LINED))
    expect(at(IN_PANE_LINED)).toBeLessThan(at(IN_PANE_INNER_LINED))
  })

  it("adds no edge: a photo without a frame, the framed card keeps its own rule", () => {
    for (const selector of [
      PAGE,
      IN_BOX,
      SUBTILE,
      IN_PANE,
      IN_PANE_INNER,
      IN_PANE_LINED,
      IN_PANE_INNER_LINED,
    ]) {
      expect(ruleBody(media, selector)).not.toMatch(/border|box-shadow|outline/)
    }
  })

  it("keeps an empty well's shape with the rule, inside the well; a well with its photo stays unframed", () => {
    const EMPTY = '[data-media-ground="page"] :is(.bg-media, .bg-media-deep):not(:has(img))'
    expect(ruleBody(media, EMPTY)).toContain("box-shadow: inset 0 0 0 1px var(--color-rule);")
    expect(ruleBody(media, EMPTY)).not.toMatch(/background|border|outline/)
  })

  it("is unlayered, so the mark outranks the well's utility, and loaded after the boxes", () => {
    expect(media).not.toContain("@layer")
    const styles = atolyeCss("styles.css")
    expect(styles).toContain('@import "./media.css";')
    expect(styles.indexOf('"./media.css"')).toBeGreaterThan(styles.indexOf('"./surface.css"'))
  })

  it("marks nothing at the default: every well prints its tone as before the step", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ theme: themeView(DEFAULT_THEME) }))
    expect(html).not.toContain("data-media-ground")
    const page = renderFrame(
      atolyeTheme,
      shopFixture({ theme: themeView({ ...DEFAULT_THEME, media_ground: "page" }) })
    )
    expect(/^<div[^>]*>/.exec(page)?.[0]).toContain('data-media-ground="page"')
  })
})
