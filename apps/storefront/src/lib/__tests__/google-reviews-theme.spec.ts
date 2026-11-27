import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ReviewsPageView } from "@qticaret/ui"
import type { StoreGoogleReviews } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { byDate, googleReviewItem, googleReviewsView } from "@/lib/views/google-reviews"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0058 as the storefront draws it: the shop's Google reviews on
 * `/yorumlar`, apart from its own, with Google's own figures and a way out
 * to Google; never in structured data.
 */

const LINK =
  "https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1sCi9DQUlRQUNvZENodHljRjlvT2poeVpXVk9hRkJ0UWtSSmEyRm9NbVJrYkVOS1UyYxAB!2m1!1s0x0:0x4f3?hl=tr"

const answer: NonNullable<StoreGoogleReviews["google_reviews"]> = {
  title: "Bıçak Atölyesi",
  rating: 4.6,
  count: 126,
  maps_url: "https://maps.google.com/maps?cid=1267",
  write_url: "https://search.google.com/local/writereview?placeid=ChIJ",
  reviews: [
    {
      id: "grev_1",
      author: "Mehmet Kaya",
      photo_url: "https://lh3.googleusercontent.com/a/x=s120",
      rating: 5,
      comment: "Şam çeliği av bıçağı aldım, kılıfı gerçek deri.",
      created_at: "2026-11-02T09:00:00Z",
      reply: {
        comment: "Güzel yorumunuz için teşekkür ederiz.",
        created_at: "2026-11-02T18:00:00Z",
      },
      url: LINK,
    },
    {
      id: "grev_2",
      author: null,
      photo_url: null,
      rating: 4,
      comment: null,
      created_at: "2026-10-20T09:00:00Z",
      reply: null,
      url: null,
    },
  ],
}

const page = (over: Partial<ReviewsPageView> = {}): ReviewsPageView => ({
  title: "Müşteri yorumları",
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Müşteri yorumları", path: null },
  ],
  average: null,
  count: 0,
  reviews: [],
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: { 1: "/yorumlar" } },
  ...over,
})

describe("the Google reviews' view", () => {
  it("keeps Google's own average and count, names the anonymous reviewer, dates in words", () => {
    const view = googleReviewsView(answer, t)

    expect(view).toMatchObject({
      average: "4,6",
      rating: 4.6,
      count: 126,
      label: "Google'da 5 üzerinden 4,6, 126 yorum",
      allUrl: "https://maps.google.com/maps?cid=1267",
    })
    expect(view?.reviews[0]).toMatchObject({
      author: "Mehmet Kaya",
      ratingLabel: "5 üzerinden 5 yıldız",
      date: { label: "2 Kasım 2026", dateTime: "2026-11-02T09:00:00.000Z" },
      reply: { text: "Güzel yorumunuz için teşekkür ederiz." },
    })
    expect(view?.reviews[1]).toMatchObject({
      author: "Google kullanıcısı",
      text: null,
      photo: null,
    })
  })

  it("is none without an answer or anything to show, and links out over https only", () => {
    expect(googleReviewsView(null, t)).toBeNull()
    expect(googleReviewsView({ ...answer, rating: null, reviews: [] }, t)).toBeNull()
    expect(
      googleReviewsView({ ...answer, maps_url: "javascript:alert(1)", write_url: "http://x" }, t)
    ).toMatchObject({ allUrl: null, writeUrl: null })
  })
})

describe("the themes' Google reviews", () => {
  const google = googleReviewsView(answer, t)
  // The page as read: React writes an apostrophe as an entity
  const words = (html: string) => html.replaceAll("&#x27;", "'")

  it("Atölye: Google's figures, each review whole with the reply, out to Google in a new tab", () => {
    const html = words(renderPage(atolyeTheme, "ReviewsPage", { view: page({ google }) }))

    expect(html).toContain("Google yorumları")
    expect(html).toContain("4,6")
    expect(html).toContain("Google'da 5 üzerinden 4,6, 126 yorum")
    expect(html).toContain("Şam çeliği av bıçağı aldım")
    expect(html).toContain("Mağazanın yanıtı")
    expect(html).toContain('src="https://lh3.googleusercontent.com/a/x=s120"')
    // Google's photo asked for without the shop's address in the referrer
    expect(html).toMatch(/referrerpolicy="no-referrer"/i)
    expect(html).toContain('href="https://maps.google.com/maps?cid=1267"')
    expect(html).toMatch(/target="_blank" rel="noopener noreferrer"/)
    expect(html).toContain("Google kullanıcısı")
    // Text only: no structured data of any kind for Google's reviews
    expect(html).not.toContain("application/ld+json")
    expect(html).not.toContain("itemprop")
  })

  it("draws no Google block without one", () => {
    const without = renderPage(atolyeTheme, "ReviewsPage", { view: page() })

    expect(without).not.toContain("Google yorumları")
  })
})

/** adr/0058 Ek 2026-11-27: Google's reviews among the shop's, in the same card, Google's figures apart. */
describe("the reviews page with Google's reviews mixed in", () => {
  const [linked, unlinked] = answer.reviews
  const words = (html: string) => html.replaceAll("&#x27;", "'")

  it("makes a Google review a card: its link on Google, else the place; the reply signed by the shop", () => {
    const item = linked && googleReviewItem(linked, answer.maps_url, "Bıçak Atölyesi", t)
    const bare = unlinked && googleReviewItem(unlinked, answer.maps_url, "Bıçak Atölyesi", t)

    expect(item).toMatchObject({
      rating: 5,
      title: null,
      body: "Şam çeliği av bıçağı aldım, kılıfı gerçek deri.",
      author: "Mehmet Kaya",
      date: "2 Kasım 2026",
      verified: false,
      product: null,
      reply: { text: "Güzel yorumunuz için teşekkür ederiz.", author: "Bıçak Atölyesi" },
      google: { url: LINK, label: "Mehmet Kaya adlı kişinin yorumunu Google'da gör" },
    })
    // No text, no own link: an empty body, the place on Maps
    expect(bare).toMatchObject({
      body: "",
      author: "Google kullanıcısı",
      google: { url: "https://maps.google.com/maps?cid=1267" },
    })
    expect(
      linked && googleReviewItem({ ...linked, url: "javascript:alert(1)" }, null, "X", t)?.google
    ).toMatchObject({ url: null })
  })

  it("merges the two lists by date, the shop's first on the same moment", () => {
    expect(
      byDate(
        [
          { at: "2026-11-05T00:00:00Z", item: "s1" },
          { at: "2026-11-02T00:00:00Z", item: "s2" },
        ],
        [
          { at: "2026-11-03T00:00:00Z", item: "g1" },
          { at: "2026-11-02T00:00:00Z", item: "g2" },
          { at: null, item: "g3" },
        ]
      )
    ).toEqual(["s1", "g1", "s2", "g2", "g3"])
  })

  it("Atölye: the same card with Google's mark and link where the product is; Google's figures apart", () => {
    const google = googleReviewsView({ ...answer, reviews: [] }, t)
    const mixed = [linked, unlinked].flatMap((each) => {
      const item = each && googleReviewItem(each, answer.maps_url, "Bıçak Atölyesi", t)
      return item ? [item] : []
    })
    const html = words(
      renderPage(atolyeTheme, "ReviewsPage", {
        view: page({
          google,
          average: 4.8,
          count: 2,
          reviews: [
            {
              rating: 5,
              title: "Çok keskin",
              body: "Elime ulaştı.",
              author: "A. Y.",
              date: "5 Kasım 2026",
              verified: true,
              product: { label: "Av bıçağı", path: "/urun/av-bicagi", image: null },
            },
            ...mixed,
          ],
        }),
      })
    )

    expect(html).toContain("Değerlendirilen ürün")
    expect(html).toContain('href="/urun/av-bicagi"')
    expect(html).toContain("Google yorumu")
    expect(html).toContain("Google'da gör")
    expect(html).toContain(`href="${LINK.replaceAll("&", "&amp;")}"`)
    expect(html).toContain('href="https://maps.google.com/maps?cid=1267"')
    expect(html).toMatch(/target="_blank" rel="noopener noreferrer"/)
    expect(html).toContain("Mehmet Kaya adlı kişinin yorumunu Google'da gör")
    // Google's own figures in a box of their own, never one block of Google cards below
    expect(html).toContain("Google'da 5 üzerinden 4,6, 126 yorum")
    expect(html).toContain("Google puanı mağaza puanımıza katılmaz")
    expect(html).not.toContain('id="google-yorumlari"')
    expect(html).not.toContain("application/ld+json")
  })
})
