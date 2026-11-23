import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { SECTION_VARIANTS } from "@qticaret/types"
import type {
  BannerSectionView,
  HomeSectionView,
  ImageView,
  PlaceOrderResult,
  PostCardView,
  PostsSectionView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The posts' intro panel and the split band (adr/0077 Ek, "Vadi"): each a
 * new variant beside today's drawing, which stays as it was; each paints
 * its section's ground on its own panel (a light tint, the dark stage
 * unless the shop set one), so the section's box carries no ground.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  sources: { avif: null, webp: null },
})

const post = (at: number): PostCardView => ({
  title: `Gizli koylar ${String(at)}`,
  path: `/blog/koylar-${String(at)}`,
  excerpt: "Kısa",
  image: picture(`koy-${String(at)}`),
  date: "1 Kasım 2026",
  dateTime: "2026-11-01T09:00:00.000Z",
  reading: "5 dk okuma",
  category: null,
})

const guides = (over: Partial<PostsSectionView> = {}): PostsSectionView => ({
  id: "yazilar",
  type: "posts",
  title: "Gezi yazıları",
  posts: [post(1), post(2), post(3), post(4)],
  more: { label: "Tüm yazılar", path: "/blog" },
  ...over,
})

const band = (over: Partial<BannerSectionView> = {}): BannerSectionView => ({
  id: "kampanya",
  type: "banner",
  slides: [
    {
      image: picture("vadi"),
      mobileImage: null,
      heading: "Sıradaki maceranız",
      text: "Esnek rezervasyon",
      link: { label: "Paketleri gör", path: "/turlar" },
      secondLink: null,
      tone: "light",
    },
    {
      image: picture("ikinci"),
      mobileImage: null,
      heading: "İkinci",
      text: null,
      link: null,
      secondLink: null,
      tone: "light",
    },
  ],
  width: "boxed",
  height: "medium",
  text_position: "bottom_left",
  overlay: "medium",
  button_style: "solid",
  ...over,
})

const draw = (section: HomeSectionView) =>
  renderPage(atolyeTheme, "HomePage", {
    view: { sections: [section] },
    subscribe: (): Promise<PlaceOrderResult> =>
      Promise.resolve({ ok: true, error: null, challenge: null }),
  })

describe("the posts' intro panel (adr/0077 Ek)", () => {
  it("draws every variant on the contract's list", () => {
    expect(SECTION_VARIANTS.posts).toEqual(["grid", "intro_panel"])
  })

  it("draws today's tiles when no variant (or an unknown one) is set", () => {
    for (const html of [draw(guides()), draw(guides({ variant: "mosaic" as never }))]) {
      expect(html).not.toContain("gf-ground")
      expect(html).toContain("md:grid-cols-[repeat(3,minmax(0,1fr))]")
    }
  })

  it("draws one panel: the upper line, heading, intro and button beside three cards", () => {
    const html = draw(
      guides({
        variant: "intro_panel",
        eyebrow: "İlham mı lazım?",
        intro: "Rota önerileri ve gezi notları.",
        more: { label: "Yazıları oku", path: "/blog/rehber" },
      })
    )
    expect(html).toMatch(/data-ground="well" class="gf-ground [^"]*rounded-tile/)
    expect(html).toContain("İlham mı lazım?")
    expect(html).toContain("Rota önerileri ve gezi notları.")
    expect(html).toMatch(/<a href="\/blog\/rehber" class="gf-btn">Yazıları oku<\/a>/)
    expect(html.match(/<article /g)).toHaveLength(3)
    expect(html).not.toContain("Gizli koylar 4")
    expect(html).toContain("5 dk okuma")
    expect(html).toContain('<time dateTime="2026-11-01T09:00:00.000Z">1 Kasım 2026</time>')
    expect(html).toContain("lg:grid-cols-3")
    expect(html).not.toContain("style=")
  })

  it("paints the shop's ground on the panel, not on the section's box", () => {
    const html = draw(
      guides({ variant: "intro_panel", look: { ground: "stage", space_inner: "small" } })
    )
    expect(html).toMatch(/data-ground="stage" class="gf-ground [^"]*gf-stage/)
    expect(html).toMatch(/class="group\/look gf-look"[^>]*data-inner="small"/)
    expect(html).not.toMatch(/class="group\/look gf-look[^"]*"[^>]*data-ground=/)
  })

  it("draws two cards two across", () => {
    const html = draw(guides({ variant: "intro_panel", posts: [post(1), post(2)] }))
    expect(html.match(/<article /g)).toHaveLength(2)
    expect(html).toContain('class="grid gap-4 sm:grid-cols-2"')
  })
})

describe("the split band (adr/0077 Ek)", () => {
  it("draws every variant on the contract's list", () => {
    expect(SECTION_VARIANTS.banner).toEqual(["standard", "split"])
  })

  it("draws today's slides when no variant is set", () => {
    const html = draw(band())
    expect(html).not.toContain("gf-split")
    expect(html).toContain("Sıradaki maceranız")
    expect(html).toContain("İkinci")
  })

  it("draws the first slide beside its words on the dark stage, straight by default", () => {
    const html = draw(band({ variant: "split", eyebrow: "Özel fırsat" }))
    expect(html).toMatch(
      /data-ground="stage" data-edge="straight" class="gf-ground gf-split [^"]*gf-stage[^"]*rounded-tile/
    )
    expect(html).toContain("Özel fırsat")
    expect(html).toContain("Sıradaki maceranız")
    expect(html).not.toContain("İkinci")
    expect(html).toMatch(/<a href="\/turlar" class="gf-btn">Paketleri gör<\/a>/)
    expect(html).toContain("aspect-[4/3] lg:aspect-auto lg:min-h-96")
    expect(html).not.toContain("style=")
  })

  it("bows the edge, takes the shop's colour and goes edge to edge as set", () => {
    const html = draw(
      band({ variant: "split", edge: "curved", width: "full", look: { ground: "primary" } })
    )
    expect(html).toMatch(/data-ground="primary" data-edge="curved" class="gf-ground gf-split/)
    expect(html).not.toMatch(/gf-split[^"]*rounded-tile/)
    expect(html).not.toMatch(/gf-look[^>]*data-ground=/)
  })
})
