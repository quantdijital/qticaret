import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { baseTheme } from "@qticaret/theme-base"
import type { ReviewsPageView } from "@qticaret/ui"
import type { StoreGoogleReviews } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { googleReviewsView } from "@/lib/views/google-reviews"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0058 as the storefront draws it: the shop's Google reviews on
 * `/yorumlar`, apart from its own, with Google's own figures and a way out
 * to Google; never in structured data.
 */

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
    },
    {
      id: "grev_2",
      author: null,
      photo_url: null,
      rating: 4,
      comment: null,
      created_at: "2026-10-20T09:00:00Z",
      reply: null,
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
    expect(html).toContain("İşletmenin yanıtı")
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

  it("base: the same, plain; neither theme draws a Google block without one", () => {
    const html = words(renderPage(baseTheme, "ReviewsPage", { view: page({ google }) }))
    const without = renderPage(atolyeTheme, "ReviewsPage", { view: page() })
    const plainWithout = renderPage(baseTheme, "ReviewsPage", { view: page() })

    expect(html).toContain("Google yorumları")
    expect(html).toContain("Google'da 5 üzerinden 4,6, 126 yorum")
    expect(html).toContain("İşletmenin yanıtı")
    expect(html).toContain('href="https://maps.google.com/maps?cid=1267"')
    expect(html).not.toContain("application/ld+json")
    expect(without).not.toContain("Google yorumları")
    expect(plainWithout).not.toContain("Google yorumları")
  })
})
