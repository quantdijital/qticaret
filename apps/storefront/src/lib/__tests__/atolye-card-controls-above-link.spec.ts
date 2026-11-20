// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ActionResult, ImageView, ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"

/**
 * A card's controls on its photo (the round quick add, the quick view)
 * take a click above the card's link (the name's `after:inset-0`), even
 * while the photo's well lifts under a mouse (`motion.css`, `lively`): the
 * lift's `transform` made the well a stacking context that painted under
 * the link, so a real click on "+" opened the product (fix 2026-11-20).
 *
 * jsdom neither lays out nor resolves the theme's layered CSS, so the
 * stacking is checked where it is decided: the markup puts every control
 * inside a positioned `.gf-card-media` and the stretched link outside it,
 * with no z-index of its own on its `::after`; `card.css` gives that well a
 * z-index above the link's (auto) and lets a click on the photo through to
 * it. A real click is the main session's browser check.
 */

const SRC = path.resolve(import.meta.dirname, "../../../../../packages/themes/atolye/src")
const CARD_CSS = readFileSync(path.join(SRC, "card.css"), "utf8")
const MOTION_CSS = readFileSync(path.join(SRC, "motion.css"), "utf8")

/** The declarations of the first rule whose selector is exactly `selector`. */
function ruleOf(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`)
  expect(at, selector).toBeGreaterThan(-1)
  const open = css.indexOf("{", at)
  return css.slice(open + 1, css.indexOf("}", open))
}

const image = (src: string): ImageView => ({
  src,
  alt: "Termos",
  width: 800,
  height: 800,
  sources: { avif: null, webp: null },
})

const card = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Termos ${id}`,
  path: `/urun/termos-${id}`,
  brand: null,
  image: image(`https://cdn.example/${id}.jpg`),
  secondImage: image(`https://cdn.example/${id}-2.jpg`),
  price: { current: "1.200,00 TL", before: null, from: false, discount: null },
  available: true,
  quickAdd: { variantId: `var_${id}` },
  ...over,
})

const listing = (products: ProductCardView[]): ListingPageView => ({
  title: "Termoslar",
  description: [],
  breadcrumbs: [],
  subcategories: [],
  products,
  total: products.length,
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: {} },
  sort: [],
  filters: [],
  price: null,
  active: [],
  clearPath: null,
})

const quickAdd = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })

function cardsOf(products: ProductCardView[]): HTMLElement[] {
  const html = renderPage(atolyeTheme, "ListingPage", { view: listing(products), quickAdd })
  const doc = new DOMParser().parseFromString(html, "text/html")
  return [...doc.querySelectorAll<HTMLElement>("article.gf-card")]
}

describe("a card's controls above its link", () => {
  const cards = cardsOf([
    card("standart", { quickView: "hover" }),
    card("cerceveli", {
      quickView: "icon",
      variant: "framed",
      framed: { freeShipping: false, fullButton: false, buttonStyle: "outline" },
    }),
  ])

  it("draws both cards the test means: the standard and the framed with a round quick add", () => {
    expect(cards).toHaveLength(2)
    expect(cards[1]?.classList.contains("gf-card-framed")).toBe(true)
  })

  for (const [at, name] of [
    [0, "the standard card"],
    [1, "the framed card"],
  ] as const) {
    it(`keeps ${name}'s quick add and quick view in the positioned well, the link outside it`, () => {
      const article = cards[at]
      const media = article?.querySelector<HTMLElement>(".gf-card-media")
      const link = article?.querySelector<HTMLAnchorElement>('a[class*="after:inset-0"]')
      expect(media?.classList.contains("relative")).toBe(true)
      expect(link).toBeTruthy()
      expect(media?.contains(link ?? null)).toBe(false)
      // The link's cover keeps the browser's own z-index (auto), under the well's
      expect(link?.className).not.toMatch(/after:-?z-/)

      const buttons = [...(media?.querySelectorAll("button") ?? [])].map((b) =>
        b.getAttribute("aria-label")
      )
      const title = at === 0 ? "Termos standart" : "Termos cerceveli"
      expect(buttons).toContain(t("product.quick_add_label", { title }))
      expect(buttons).toContain(t("product.quick_view_label", { title }))
    })
  }

  it("gives the well a z-index above the link's and lets a click on the photo through", () => {
    const well = ruleOf(CARD_CSS, ".gf-card .gf-card-media")
    expect(well).toContain("z-index: 1;")
    expect(well).toContain("pointer-events: none;")
    const back = ruleOf(
      CARD_CSS,
      ".gf-card .gf-card-media :is(a, button, input, select, textarea, label, summary)"
    )
    expect(back).toContain("pointer-events: auto;")
  })

  it("is the lift under a mouse that makes the well a stacking context (why the z-index is needed)", () => {
    expect(MOTION_CSS).toMatch(/\.gf-card:not\(\.gf-card-framed\):hover \.gf-card-media/)
    expect(MOTION_CSS).toContain("transform: translateY(-3px);")
  })
})
