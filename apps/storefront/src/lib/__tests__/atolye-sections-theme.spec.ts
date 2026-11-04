import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ProductCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Atölye home page's sections after the opening, drawn from the
 * shop's own sections (adr/0049): each by its type, nothing invented,
 * every panel and answer in the HTML.
 */

const product = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: "Atölye",
  image: null,
  price: { current: "449,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const shelf = (id: string, title: string, products: ProductCardView[]): HomeSectionView => ({
  id,
  type: "products",
  title,
  products,
  more: { label: "Tüm ürünler", path: "/magaza" },
  empty: "Henüz ürün yok.",
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the Atölye shelf", () => {
  it("draws a product section as a grid of cards with its title and link", () => {
    const html = home([shelf("yeni", "Yeni ürünler", [product("a"), product("b")])])

    expect(html).toContain('<h2 id="bolum-yeni">Yeni ürünler</h2>')
    expect(html).toContain('href="/magaza"')
    expect(html.match(/<article/g)).toHaveLength(2)
    expect(html).not.toContain('role="tablist"')
  })

  it("puts neighbouring product sections in one shelf, every panel in the HTML", () => {
    const html = home([
      shelf("yeni", "Yeni ürünler", [product("a")]),
      shelf("cok", "Çok satanlar", [product("b")]),
    ])

    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Ürün bölümleri"')
    expect(html).toContain('href="/urun/a"')
    expect(html).toContain('href="/urun/b"')
    // Without script the tab row waits and both panels show, each under its heading
    expect(html).toMatch(/<div role="tablist"[^>]*hidden=""/)
    expect(html).not.toMatch(/id="bolum-yeni-panel-1"[^>]*hidden/)
  })

  it("marks a discount and a sold-out product in words, never greying the picture", () => {
    const html = home([
      shelf("yeni", "Yeni ürünler", [
        product("a", {
          price: { current: "300,00 TL", before: "400,00 TL", from: false, discount: 25 },
        }),
        product("b", { available: false }),
      ]),
    ])

    expect(html).toContain("%25 indirim")
    expect(html).toContain("Tükendi")
    expect(html).toContain("<s ")
    expect(html).not.toContain("grayscale")
  })

  it("says so in the shop's words when a section has no product", () => {
    expect(home([shelf("yeni", "Yeni ürünler", [])])).toContain("Henüz ürün yok.")
  })
})

describe("the Atölye story sections", () => {
  it("lists guides as ruled rows with their date and reading time on separate lines", () => {
    const html = home([
      {
        id: "blog",
        type: "posts",
        title: "Blogdan",
        more: { label: "Tüm yazılar", path: "/blog" },
        posts: [
          {
            title: "Bakım",
            path: "/blog/bakim",
            excerpt: "Kısa özet.",
            image: null,
            date: "1 Kasım 2026",
            dateTime: "2026-11-01",
            reading: "3 dk okuma",
          },
        ],
      },
    ])

    expect(html).toContain('<time dateTime="2026-11-01">1 Kasım 2026</time><span>3 dk okuma</span>')
    expect(html).not.toContain("·")
  })

  it("draws the shop's reviews as given, and nothing when there is none", () => {
    const reviews: HomeSectionView = {
      id: "yorum",
      type: "reviews",
      title: "Müşteri yorumları",
      more: { label: "Tüm yorumlar", path: "/yorumlar" },
      reviews: [
        {
          rating: 4,
          title: "Güzel",
          body: "Elime ulaştı.",
          author: "A. Y.",
          date: "2 Kasım 2026",
          verified: true,
          product: { label: "Ürün a", path: "/urun/a" },
        },
      ],
    }
    const html = home([reviews])

    expect(html).toContain('aria-label="5 üzerinden 4 yıldız"')
    expect(html).toContain("Doğrulanmış alışveriş")
    expect(home([{ ...reviews, reviews: [] }])).not.toContain("Müşteri yorumları")
  })

  it("keeps every answer of the FAQ in the HTML, in native disclosures", () => {
    const html = home([
      {
        id: "sss",
        type: "faq",
        title: null,
        items: [
          { question: "Kargo ne zaman?", answer: "1–3 iş günü." },
          { question: "İade?", answer: "14 gün içinde <ücretsiz>." },
        ],
      },
    ])

    expect(html).toContain("Sık sorulan sorular")
    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html).toContain("14 gün içinde &lt;ücretsiz&gt;.")
  })

  it("offers the help band's ways to reach the shop, only those it gave", () => {
    const html = home([
      {
        id: "yardim",
        type: "help",
        title: "Sorunuz mu var?",
        text: "Bize yazın.",
        contact: {
          email: null,
          phone: "0532 000 00 00",
          phoneHref: "tel:+905320000000",
          whatsappHref: null,
          address: null,
          hours: [],
          mapHref: null,
        },
      },
    ])

    expect(html).toContain('href="tel:+905320000000"')
    expect(html).not.toContain("wa.me")
    expect(html).not.toContain("mailto:")
  })
})
