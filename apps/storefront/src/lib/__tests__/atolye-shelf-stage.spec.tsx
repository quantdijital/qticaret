import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { SHELF_STAGE_DEFAULTS } from "@qticaret/types/section-shelf"
import type { HomeSectionView, ImageView, ProductCardView, ProductsSectionView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * A product rail drawn as a stage list (adr/0049 Ek 2026-11-16): one
 * product large on a stage beside the list of the rail's; following the
 * list, every product listed and the first on the stage (the others
 * waiting hidden), its row marked; not following, the first on the stage
 * and the rest listed. Each row one link; the stage's one action.
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
  quickAdd: { variantId: `var_${id}` },
  ...over,
})

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => product(`p${String(index)}`))

const rail = (over: Partial<ProductsSectionView> = {}): HomeSectionView => ({
  id: "raf",
  type: "products",
  title: "Çok satanlar",
  products: many(4),
  more: { label: "Tümünü gör", path: "/kategori/raf" },
  empty: "Henüz yayında ürün yok.",
  variant: "stage_list",
  stage: SHELF_STAGE_DEFAULTS,
  ...over,
})

const quickAdd = () => Promise.resolve({ ok: true as const, error: null })

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections }, quickAdd })

const count = (html: string, needle: string) => html.split(needle).length - 1

/** The stage panel of `at`, from its opening tag to the next panel or the list. */
const panelOf = (html: string, at: number) => {
  const start = html.indexOf(`data-stage="${String(at)}"`)
  const end = html.indexOf("data-stage=", start + 12)
  return start < 0 ? "" : html.slice(start, end < 0 ? html.indexOf("gf-stage-rows", start) : end)
}

describe("a product rail drawn as a stage list", () => {
  it("lists every product beside the stage under the rail's head, the first on the stage", () => {
    const html = home([rail()])
    expect(html).toContain(">Çok satanlar</h2>")
    expect(html).toContain('href="/kategori/raf"')
    expect(html).toMatch(
      /class="gf-stage-list" data-side="start" data-ground="stage" data-follow="on" data-rows="4"/
    )
    expect(html).toContain('class="gf-stage-box rounded-tile gf-stage"')
    expect(count(html, 'class="gf-stage-row group relative"')).toBe(4)
    expect(count(html, "data-pick=")).toBe(4)
    // The first row marked, the first panel shown, the others hidden until the list calls them
    expect(html).toMatch(/<li data-pick="0" data-on="">/)
    expect(count(html, "data-on=")).toBe(1)
    expect(count(html, 'class="gf-stage-panel group relative"')).toBe(4)
    expect(html).toContain('data-stage="0">')
    expect(html).toContain('data-stage="3" hidden=""')
    expect(html).not.toMatch(/\sstyle="/)
  })

  it("gives the stage the add button and the price large, a row only its link", () => {
    const html = home([rail()])
    const stage = panelOf(html, 0)
    expect(stage).toContain(">Ürün p0</a></h3>")
    expect(stage).toContain('value="var_p0"')
    expect(stage).toContain("text-price")
    expect(count(html, 'value="var_p')).toBe(4)
    // Every photo lazy: the rail is below the page's opening, the hidden ones wait
    expect(count(html, 'loading="lazy"')).toBe(8)
    expect(html).not.toContain('fetchPriority="high"')
    expect(count(html, 'href="/urun/p2"')).toBe(2)
  })

  it("puts the first on the stage and lists the rest when the stage does not follow", () => {
    const html = home([
      rail({
        products: many(5),
        stage: { stage_side: "end", stage_ground: "well", stage_follow: "off" },
      }),
    ])
    expect(html).toMatch(
      /class="gf-stage-list" data-side="end" data-ground="well" data-follow="off" data-rows="4"/
    )
    expect(html).toContain('class="gf-stage-box rounded-tile"')
    expect(count(html, 'class="gf-stage-panel group relative"')).toBe(1)
    expect(html).not.toContain("data-pick=")
    expect(html).not.toContain("data-on=")
    expect(count(html, 'href="/urun/p0"')).toBe(1)
    expect(count(html, 'class="gf-stage-row group relative"')).toBe(4)
  })

  it("marks a discount and a sold-out product, offers no add for one sold out, options for many", () => {
    const html = home([
      rail({
        products: [
          product("tukendi", { available: false, stock: "out", quickAdd: null }),
          product("indirim", {
            price: { current: "900,00 TL", before: "1.200,00 TL", from: false, discount: 25 },
          }),
          product("secenek", { quickAdd: null }),
          product("gorselsiz", { image: null }),
        ],
      }),
    ])
    expect(panelOf(html, 0)).not.toContain("Sepete ekle")
    expect(panelOf(html, 0)).toContain("Tükendi")
    expect(html).toContain('class="gf-stage-pill" data-tone="out">Tükendi</p>')
    expect(html).toContain('class="gf-stage-pill" data-tone="deal"')
    expect(html).toContain("%25 indirim")
    expect(panelOf(html, 2)).toContain(">Seçenekler</a>")
    expect(panelOf(html, 3)).not.toContain("<img")
  })

  it("draws the stage alone with one product, no list", () => {
    const html = home([
      rail({ products: many(1), stage: { ...SHELF_STAGE_DEFAULTS, stage_follow: "off" } }),
    ])
    expect(count(html, 'class="gf-stage-panel group relative"')).toBe(1)
    expect(html).not.toContain("gf-stage-rows")
  })

  it("joins its neighbour's tabs as any rail", () => {
    const html = home([rail(), rail({ id: "raf2", title: "İndirimde", variant: "grid" })])
    expect(html).toContain('class="gf-tab"')
    expect(html).toContain("gf-stage-list")
  })
})
