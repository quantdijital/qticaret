import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  FormAction,
  HomeSectionView,
  ImageView,
  ProductCardView,
  ProductsSectionView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"
import { QuickAdd } from "../../../../../packages/themes/atolye/src/parts/QuickAdd"

/**
 * A product rail drawn as a ranked list (adr/0049 Ek 2026-11-16): one
 * ordered list, each product beside its place in large figures (for the
 * eye; the reader hears "1." in its heading), the card's parts — brand,
 * name as the one link, stars, price — and its quick view and quick add
 * as icons beside each place.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 1000,
  sources: { avif: `/media/${name}-400.avif 400w`, webp: null },
})

const product = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: "Marka",
  image: picture(id),
  price: { current: "1.299,90 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => product(`p${String(index + 1)}`))

const rail = (over: Partial<ProductsSectionView> = {}): HomeSectionView => ({
  id: "raf",
  type: "products",
  title: "İndirimdekiler",
  products: many(5),
  more: { label: "Tümünü gör", path: "/kampanyalar" },
  empty: "Henüz yayında ürün yok.",
  variant: "ranked",
  rankedLayout: "lead",
  ...over,
})

const act: FormAction = () => Promise.resolve({ ok: true, error: null })

const home = (sections: HomeSectionView[], quickAdd?: FormAction) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections }, ...(quickAdd ? { quickAdd } : {}) })

const count = (html: string, needle: string) => html.split(needle).length - 1

/** One place, from its `<li>` to its close. */
const placeOf = (html: string, place: number) => {
  const items = html.split('<li class="gf-rank"').slice(1)
  const item = items[place - 1] ?? ""
  return item.slice(0, item.indexOf("</li>"))
}

describe("a product rail drawn as a ranked list", () => {
  it("draws its products as one ordered list under the rail's head and its link", () => {
    const html = home([rail()])
    expect(html).toContain(">İndirimdekiler</h2>")
    expect(html).toContain('href="/kampanyalar"')
    expect(html).toContain('<ol role="list" class="gf-ranked" data-layout="lead" data-count="5">')
    expect(count(html, '<li class="gf-rank"')).toBe(5)
    expect(html).not.toMatch(/\sstyle="/)
  })

  it("stands the first large on a lead rail, every place large on a row rail", () => {
    const lead = home([rail()])
    expect(placeOf(lead, 1)).toMatch(/^ data-size="lead"/)
    for (const place of [2, 3, 4, 5]) {
      expect(placeOf(lead, place)).toMatch(/^ data-size="line"/)
    }
    const row = home([rail({ rankedLayout: "row" })])
    expect(row).toContain('data-layout="row"')
    expect(count(row, 'data-size="row"')).toBe(5)
  })

  it("draws a rail without its layout (an older storefront) as lead", () => {
    const older = { ...rail() } as Partial<ProductsSectionView>
    delete older.rankedLayout
    const html = home([older as HomeSectionView])
    expect(html).toContain('data-layout="lead"')
  })

  it("shows each place's figure to the eye only, the reader hearing it in the heading", () => {
    const html = home([rail()])
    const second = placeOf(html, 2)
    expect(second).toContain('<span class="gf-rank-n" aria-hidden="true">2</span>')
    expect(second).toMatch(
      /<h3 class="gf-rank-title"><span class="sr-only">2\. <\/span><a href="\/urun\/p2"[^>]*>Ürün p2<\/a><\/h3>/
    )
    expect(second).toContain('<p class="gf-rank-brand">Marka</p>')
    // The name is the one link to the product's page
    expect(count(second, 'href="/urun/p2"')).toBe(1)
  })

  it("marks a place past nine wide, for its two figures", () => {
    const html = home([rail({ products: many(10) })])
    expect(html).toContain('data-count="10"')
    expect(placeOf(html, 9)).not.toContain("data-wide")
    expect(placeOf(html, 10)).toMatch(/^ data-size="line" data-wide=""/)
  })

  it("prices each place as every card: a discount's pill on the photograph and the struck price", () => {
    const html = home([
      rail({
        products: [
          product("p1", {
            price: { current: "1.050,00 TL", before: "1.500,00 TL", from: false, discount: 30 },
          }),
          ...many(4).slice(1),
        ],
      }),
    ])
    const sale = placeOf(html, 1)
    expect(sale).toContain(
      '<p class="gf-rank-pill" data-tone="deal"><span aria-hidden="true">%30</span><span class="sr-only">%30 indirim</span></p>'
    )
    expect(sale).toContain("1.050,00 TL")
    expect(sale).toContain("1.500,00 TL")
    expect(placeOf(html, 2)).not.toContain("gf-rank-pill")
  })

  it("puts sold out over a discount, with no quick add on a sold-out place", () => {
    const html = home(
      [
        rail({
          products: [
            product("p1", {
              available: false,
              quickAdd: { variantId: "var_p1" },
              price: { current: "1.050,00 TL", before: "1.500,00 TL", from: false, discount: 30 },
            }),
            product("p2", { quickAdd: { variantId: "var_p2" } }),
            ...many(3).map((each) => ({ ...each, id: `x${each.id}` })),
          ],
        }),
      ],
      act
    )
    const out = placeOf(html, 1)
    expect(out).toContain('<p class="gf-rank-pill" data-tone="out">Tükendi</p>')
    expect(out).not.toContain("%30")
    expect(out).not.toContain('name="variant_id"')
    expect(placeOf(html, 2)).toContain('value="var_p2"')
  })

  it("keeps the card's actions as icons in a row of their own", () => {
    const html = home(
      [
        rail({
          products: [product("p1", { quickAdd: { variantId: "var_p1" }, quickView: "hover" })],
        }),
      ],
      act
    )
    const place = placeOf(html, 1)
    expect(place).toContain('class="gf-rank-acts"')
    expect(place).toContain('data-quick-view="inline"')
    // The quick add beside it, drawn by a line, not floated on the photograph's corner
    expect(place).toContain('class="relative z-(--z-raised) flex shrink-0"')
    expect(place).toContain("gf-icon-btn size-11 border border-rule")
    expect(place).not.toContain("absolute right-2 bottom-2")
  })

  it("draws no actions' row for a place with none", () => {
    const html = home([rail()], act)
    expect(html).not.toContain("gf-rank-acts")
  })

  it("keeps a product without a photograph as its place's empty well", () => {
    const html = home([rail({ products: [product("p1", { image: null }), ...many(4).slice(1)] })])
    const bare = placeOf(html, 1)
    expect(bare).toContain('<div class="gf-rank-photo"></div>')
    expect(bare).not.toContain("<img")
    expect(bare).toContain(">Ürün p1</a>")
  })

  it("loads every photograph lazily, sized for its place", () => {
    const html = home([rail()])
    expect(html).not.toContain('loading="eager"')
    expect(placeOf(html, 1)).toContain('sizes="(min-width: 1440px) 440px')
    expect(placeOf(html, 2)).toContain('sizes="(min-width: 1024px) 120px')
  })

  it("joins another rail's tabs, its head the tab row's", () => {
    const html = home([rail(), rail({ id: "raf2", title: "Yeni ürünler", variant: "grid" })])
    expect(html).toContain('class="gf-tabs')
    expect(html).toContain(">İndirimdekiler</label>")
    expect(count(html, '<li class="gf-rank"')).toBe(5)
  })

  it("shows the rail's empty words with nothing to draw", () => {
    const html = home([rail({ products: [] })])
    expect(html).toContain("Henüz yayında ürün yok.")
    expect(html).not.toContain("gf-ranked")
  })
})

describe("the quick add's inline look", () => {
  const words = {
    add: "Sepete ekle",
    label: "Ürün ürününü sepete ekle",
    added: "Eklendi",
    errors: {},
    openPage: "Ürüne git",
  }
  const draw = (inline?: boolean) =>
    renderToStaticMarkup(
      <QuickAdd
        variantId="var_1"
        path="/urun/1"
        action={act}
        words={words}
        {...(inline === undefined ? {} : { inline })}
      />
    )

  it("draws today's round button on the photograph's corner by default", () => {
    const html = draw()
    expect(html).toBe(draw(false))
    expect(html).toContain('class="relative z-(--z-raised) contents"')
    expect(html).toContain(
      'class="gf-icon-btn absolute right-2 bottom-2 z-(--z-raised) size-11 bg-field text-text shadow-float hover:bg-paper-2"'
    )
    expect(html).toContain('class="absolute inset-x-2 bottom-14 z-(--z-raised)"')
  })

  it("stands inline in its own row, its refusal opening above it", () => {
    const html = draw(true)
    expect(html).toContain('class="relative z-(--z-raised) flex shrink-0"')
    expect(html).toContain(
      'class="gf-icon-btn size-11 border border-rule bg-field text-text hover:bg-paper-2"'
    )
    expect(html).toContain("absolute right-0 bottom-full")
    expect(html).not.toContain("shadow-float")
  })
})
