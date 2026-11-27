import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ReviewView } from "@qticaret/ui"
import type { StorePhotoCollageSection } from "@qticaret/types"
import { SCROLLER_DEFAULTS } from "@qticaret/types/section-scroller"
import { t } from "@/lib/i18n"
import { collageView } from "@/lib/views/points"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0077 §10 as the storefront draws it: the photo collage as one list
 * of the shop's photographs, each with its own words; the reviews' grid
 * as before the variants, the carousel one card each with the scroller's
 * arrows.
 */

const image = (n: number) => ({
  url: `https://cdn.example.com/media/atolye-${String(n)}.jpg`,
  alt: `Atölyeden görünüm ${String(n)}`,
  width: 1600,
  height: 1200,
  derivatives: null,
})

const collage = (over: Partial<StorePhotoCollageSection> = {}): StorePhotoCollageSection => ({
  id: "kolaj01",
  type: "photo_collage",
  title: null,
  intro: null,
  items: [1, 2, 3, 4, 5].map((n) => ({ image: image(n), caption: null, link: null })),
  ...over,
})

const review = (n: number, more: Partial<ReviewView> & { product?: unknown } = {}) => ({
  rating: 5 - (n % 2),
  title: null,
  body: `Yorum ${String(n)}: elinize iyi oturuyor, kılıfı biraz sıkı.`,
  author: `Müşteri ${String(n)}`,
  date: "1 Kasım 2026",
  verified: n === 1,
  product: null,
  ...more,
})

const quotes = (more: Record<string, unknown> = {}) =>
  ({
    id: "yorumlar01",
    type: "reviews",
    title: "Müşterilerimiz ne diyor?",
    reviews: [1, 2, 3, 4, 5].map((n) => review(n)),
    more: { label: "Tüm yorumlar", path: "/yorumlar" },
    ...more,
  }) as HomeSectionView

const words = (html: string) => html.replaceAll("&#x27;", "'")
const home = (sections: HomeSectionView[]) =>
  words(renderPage(atolyeTheme, "HomePage", { view: { sections } }))
const count = (html: string, part: string) => html.split(part).length - 1

describe("the photo collage's view", () => {
  it("keeps the photographs with their words, the default settings, a list name", () => {
    const view = collageView(collage(), t)
    expect(view).toMatchObject({
      type: "photo_collage",
      title: null,
      label: "Fotoğraflar",
      layout: "asymmetric",
      phone: "scroll",
    })
    expect(view?.items[0]).toMatchObject({
      image: { alt: "Atölyeden görünüm 1" },
      caption: null,
      href: null,
    })
    // A step from a newer backend reads as the default; no photograph, no section
    expect(collageView(collage({ layout: "bento" as never }), t)?.layout).toBe("asymmetric")
    expect(collageView(collage({ items: [] }), t)).toBeNull()
  })
})

describe("the photo collage in Atölye", () => {
  const draw = (over: Partial<StorePhotoCollageSection> = {}) => {
    const view = collageView(collage(over), t)
    if (!view) {
      throw new Error("no collage")
    }
    return home([view])
  }

  it("draws every photograph with its own words, the first large, lazily", () => {
    const html = draw()
    expect(html).toContain('aria-label="Fotoğraflar"')
    for (const n of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`alt="Atölyeden görünüm ${String(n)}"`)
    }
    expect(html).toContain("lg:col-span-2 lg:row-span-2")
    expect(html).not.toContain('loading="eager"')
    expect(count(html, 'loading="lazy"')).toBe(5)
    // The phone's row swipes sideways
    expect(html).toContain("overflow-x-auto")
  })

  it("draws even tiles and one column on a phone when chosen", () => {
    const html = draw({ layout: "even", phone: "stack" })
    expect(html).not.toContain("lg:row-span-2")
    expect(html).toContain("lg:grid-cols-5")
    expect(html).not.toContain("overflow-x-auto")
  })

  it("heads it with the shop's title and intro, a caption and a link on a photograph", () => {
    const html = draw({
      title: "Atölyeden",
      intro: "Her bıçak elde biter.",
      items: [
        {
          image: image(1),
          caption: "Tezgâh",
          link: { label: null, kind: "system", target: "shop", path: null },
        },
        { image: image(2), caption: null, link: null },
        { image: image(3), caption: null, link: null },
      ],
    })
    expect(html).toContain("Atölyeden</h2>")
    expect(html).toContain("Her bıçak elde biter.")
    expect(html).toMatch(/<figcaption[^>]*>Tezgâh<\/figcaption>/)
    expect(count(html, "<a href=")).toBeGreaterThan(0)
    // The plate as before: no white card, no line over the heading
    expect(html).not.toContain("shadow-float")
    expect(html).not.toContain("tracking-[0.18em]")
  })

  it("draws the white card with its small line and arrow, the eyebrow and the list's link", () => {
    const shop = { label: null, kind: "system" as const, target: "shop" as const, path: null }
    const html = draw({
      title: "İlham veren rotalar",
      card: "below",
      layout: "even",
      eyebrow: "Popüler rotalar",
      more: { ...shop, label: "Tüm rotalar" },
      items: [
        { image: image(1), caption: "Kapadokya", subtitle: "Vadiler • Balon", link: shop },
        { image: image(2), caption: "Karadeniz", link: null },
        { image: image(3), caption: null, link: null },
      ],
    })
    expect(html).toMatch(/<p[^>]*uppercase[^>]*>Popüler rotalar<\/p><h2[^>]*>İlham veren rotalar/)
    expect(html).toMatch(/<a href="[^"]+" class="gf-link[^"]*">Tüm rotalar<svg/)
    expect(count(html, "shadow-float")).toBe(3)
    expect(html).toContain("Vadiler • Balon</span>")
    expect(html).not.toContain("<figcaption")
    // The linked card alone shows the arrow
    expect(count(html, "rounded-full border border-rule")).toBe(1)
    expect(html).not.toContain("aspect-[4/5]")
  })
})

describe("the reviews in Atölye (adr/0077 §10)", () => {
  it("draws the grid as before: three quotes, no sliding row", () => {
    const html = home([quotes()])
    expect(count(html, "<blockquote")).toBe(3)
    expect(html).not.toContain("gf-scroller")
    expect(home([quotes({ variant: "grid" })])).toBe(html)
  })

  it("draws the carousel: every review one card in the scroller, its arrows named", () => {
    const html = home([
      quotes({
        variant: "carousel",
        scroller: SCROLLER_DEFAULTS,
        reviews: [
          review(1, {
            photos: [
              {
                image: {
                  ...image(9),
                  src: "/r.jpg",
                  sources: { avif: null, webp: null },
                  alt: "Müşteri 1 fotoğrafı",
                },
              },
            ],
          }),
          ...[2, 3, 4, 5].map((n) => review(n)),
        ],
      }),
    ])
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Müşterilerimiz ne diyor?"')
    expect(count(html, "<blockquote")).toBe(5)
    expect(html).toContain('alt="Müşteri 1 fotoğrafı"')
    expect(html).toContain(`aria-label="${t("scroller.next")}"`)
    expect(html).toContain(`aria-label="${t("scroller.previous")}"`)
  })

  describe("the cards' product picture (adr/0077 §10 Ek)", () => {
    const picture = (n: number) => ({
      ...image(n),
      src: `/u${String(n)}.jpg`,
      sources: { avif: null, webp: null },
      alt: `Tur ${String(n)} görseli`,
    })
    const about = (n: number, withImage = true) => ({
      label: `Kapadokya turu ${String(n)}`,
      path: `/urun/tur-${String(n)}`,
      ...(withImage ? { image: picture(n) } : {}),
    })
    const carousel = (productImage?: string) =>
      quotes({
        variant: "carousel",
        scroller: SCROLLER_DEFAULTS,
        ...(productImage ? { product_image: productImage } : {}),
        reviews: [
          review(1, { product: about(1) }),
          review(2, { product: about(2, false) }),
          review(3),
        ],
      })

    it("draws today's card while none is asked for", () => {
      const html = home([carousel()])
      expect(home([carousel("none")])).toBe(html)
      expect(html).not.toContain('alt="Tur 1 görseli"')
      expect(html).toContain(">Kapadokya turu 1</a>")
    })

    it("draws a cover across the card's top with the product's name on it, its link", () => {
      const html = home([carousel("cover")])
      expect(html).toContain('alt="Tur 1 görseli"')
      expect(html).toContain(
        'aria-label="Yorumlanan ürün: Kapadokya turu 1"'.replace(
          "Yorumlanan ürün",
          t("reviews.about")
        )
      )
      expect(html).toContain('href="/urun/tur-1"')
      // A product without a picture keeps its name as a link
      expect(html).toContain(">Kapadokya turu 2</a>")
      expect(count(html, "<blockquote")).toBe(3)
    })

    it("draws a small square picture beside the product's name at the card's foot", () => {
      const html = home([carousel("thumb")])
      expect(html).toContain('alt="Tur 1 görseli"')
      expect(html).toContain("size-12 shrink-0")
      expect(html).toContain('href="/urun/tur-2"')
    })
  })
})
