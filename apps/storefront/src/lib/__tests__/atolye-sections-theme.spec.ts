import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ImageView, PlaceOrderResult } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The theme's home sections after the shelf (docs/tema/yon-2026-11-05.md
 * § Home): the close-up, the reviews and the customers' photos, the
 * campaign, the story, the guides, the FAQ with the help beside it and the
 * newsletter. Each from the shop's own data; empty data draws nothing.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 800,
  sources: { avif: null, webp: null },
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", {
    view: { sections },
    subscribe: (): Promise<PlaceOrderResult> =>
      Promise.resolve({ ok: true, error: null, challenge: null }),
  })

const review = (author: string, body: string) => ({
  rating: 5,
  title: null,
  body,
  author,
  date: "1 Kasım 2026",
  verified: true,
  product: { label: "Çakı", path: "/urun/caki" },
})

const reviews: HomeSectionView = {
  id: "yorum",
  type: "reviews",
  title: "Müşteri yorumları",
  reviews: [
    review("Ayşe K.", "Çok güzel bir çakı. Kutusu da özenliydi ve hızlı geldi."),
    review("Mehmet A.", "Keskin geldi."),
    review("Selin T.", "İyi."),
    review("Can B.", "Dördüncü yorum."),
  ],
  more: { label: "Tüm yorumlar", path: "/yorumlar" },
  summary: {
    average: "4,8",
    count: 28,
    label: "5 üzerinden 4,8 (28 değerlendirme)",
    distribution: [
      { stars: 5, count: 26, percent: 93, label: "5 yıldız: 26 değerlendirme" },
      { stars: 1, count: 2, percent: 7, label: "1 yıldız: 2 değerlendirme" },
    ],
  },
  photos: [
    {
      image: picture("musteri"),
      product: { label: "Çakı", path: "/urun/caki" },
      rating: 5,
      author: "Ayşe K.",
    },
  ],
}

describe("the theme's home sections", () => {
  it("sets the shop's average large with its spread, then three quotes, each whole", () => {
    const html = home([reviews])
    expect(html).toContain(">4,8</span>")
    expect(html).toContain("28 değerlendirme")
    expect(html).toContain("5 yıldız: 26 değerlendirme")
    expect(html).toContain("“Çok güzel bir çakı. Kutusu da özenliydi ve hızlı geldi.”")
    expect(html).not.toContain("Dördüncü yorum.")
    expect(html).toContain('aria-label="Doğrulanmış alışveriş"')
  })

  it("shows the customers' photos as their own section, each named by who took it", () => {
    const html = home([reviews])
    expect(html).toContain("Müşteri fotoğrafları")
    expect(html).toContain('alt="Ayşe K. adlı müşterinin fotoğrafı: Çakı"')
    expect(html).toMatch(/src="\/media\/musteri\.jpg"[^>]*loading="lazy"/)
    // Their phone rail runs to the screen's edges but snaps at the page's gutter
    expect(html).toMatch(/class="gf-rail -mx-\(--gutter\)[^"]* scroll-px-\(--gutter\) /)
  })

  it("draws no reviews section without reviews or a summary", () => {
    const html = home([{ ...reviews, reviews: [], summary: null, photos: [] }])
    expect(html).not.toContain("Müşteri yorumları")
  })

  it("brings one product up close with its facts, price and one action", () => {
    const html = home([
      {
        id: "yakin",
        type: "featured_product",
        title: null,
        text: "Ustanın elinden.",
        product: {
          id: "p1",
          title: "Şam çeliği hançer",
          path: "/urun/hancer",
          brand: null,
          image: picture("hancer"),
          price: { current: "3.850,00 TL", before: null, from: false, discount: null },
          available: true,
        },
        subtitle: null,
        images: [picture("hancer"), picture("hancer-2")],
        facts: [{ label: "Çelik", value: "Damascus", highlight: true }],
        specGroups: [],
      },
    ])
    expect(html).toContain(">Şam çeliği hançer</h2>")
    expect(html).toContain("Ustanın elinden.")
    expect(html).toContain("Damascus")
    expect(html).toContain("3.850,00 TL")
    expect(html).toContain('href="/urun/hancer"')
  })

  it("puts the help beside the FAQ's questions, every answer in the HTML", () => {
    const html = home([
      {
        id: "sss",
        type: "faq",
        title: null,
        items: [{ question: "İade süresi?", answer: "14 gün." }],
      },
      {
        id: "yardim",
        type: "help",
        title: "Aklınıza takılan bir şey mi var?",
        text: "Bize yazın.",
        contact: {
          email: "bilgi@example.com",
          phone: null,
          phoneHref: null,
          whatsappHref: "https://wa.me/905320000000",
          address: null,
          hours: [],
          mapHref: null,
        },
      },
    ])
    expect(html).toContain("Sık sorulan sorular")
    expect(html).toContain("14 gün.")
    expect(html).toContain('aria-label="Aklınıza takılan bir şey mi var?"')
    expect(html).toContain('href="https://wa.me/905320000000"')
    expect(html.match(/bolum-yardim/g)).toBeNull()
  })

  it("lists the guides with their date, and shows the shop's campaign and story as given", () => {
    const html = home([
      {
        id: "blog",
        type: "posts",
        title: "Blogdan",
        posts: [
          {
            title: "Bakım",
            path: "/blog/bakim",
            excerpt: "Kısa",
            image: null,
            date: "1 Kasım 2026",
            dateTime: "2026-11-01",
            reading: "3 dk okuma",
          },
        ],
        more: { label: "Tüm yazılar", path: "/blog" },
      },
      {
        id: "kampanya",
        type: "banner",
        slides: [
          {
            image: picture("kampanya"),
            heading: "Kış seçkisi",
            text: null,
            link: { label: "İncele", path: "/kis" },
            mobileImage: null,
            secondLink: null,
            tone: "light",
          },
        ],
        width: "boxed",
        height: "medium",
        text_position: "bottom_left",
        overlay: "medium",
        button_style: "solid",
      },
      { id: "hikaye", type: "rich_text", title: "Neden biz?", html: "<p>Atölyemizden.</p>" },
    ])
    expect(html).toContain('<time dateTime="2026-11-01">1 Kasım 2026</time>')
    expect(html).toContain("Kış seçkisi")
    expect(html).toContain('href="/kis"')
    expect(html).toContain("<p>Atölyemizden.</p>")
    expect(html).not.toContain("·")
  })

  it("asks the newsletter's consent with an unticked, required box", () => {
    const html = home([
      {
        id: "bulten",
        type: "newsletter",
        title: "Haberdar olun",
        text: "Onay metni.",
        privacyPath: "/yasal/kvkk",
      },
    ])
    expect(html).toContain(">Haberdar olun</h2>")
    expect(html).toMatch(/<input type="checkbox" required=""[^>]*name="consent" value="1"/)
    expect(html).toContain('href="/yasal/kvkk"')
  })
})
