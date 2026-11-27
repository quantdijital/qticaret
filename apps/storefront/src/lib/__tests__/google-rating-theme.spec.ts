import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView } from "@qticaret/ui"
import type { StoreGoogleRatingSection, StoreGoogleReviews } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { googleRatingView } from "@/lib/views/google-rating"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0058 Ek 2026-11-06 as the storefront draws it: the home page's
 * Google rating badge, Google's own figures, links to `/yorumlar` and to
 * Google, recent 4–5 star excerpts; nothing at all with nothing to show,
 * and never structured data.
 */

const section = (over: Partial<StoreGoogleRatingSection> = {}): StoreGoogleRatingSection => ({
  id: "googlepuan",
  type: "google_rating",
  title: null,
  excerpts: 2,
  profile_link: true,
  ...over,
})

const review = (
  over: Partial<NonNullable<StoreGoogleReviews["google_reviews"]>["reviews"][number]> = {}
) => ({
  id: "grev_1",
  author: "Mehmet Kaya",
  photo_url: null,
  rating: 5,
  comment: "Şam çeliği av bıçağı aldım. Kılıfı gerçek deri, dikişleri çok temiz.",
  created_at: "2026-11-02T09:00:00Z",
  reply: null,
  url: null,
  ...over,
})

const answer: NonNullable<StoreGoogleReviews["google_reviews"]> = {
  title: "Bıçak Atölyesi",
  rating: 4.6,
  count: 126,
  maps_url: "https://maps.google.com/maps?cid=1267",
  write_url: null,
  reviews: [
    review(),
    review({ id: "grev_2", author: null, rating: 4, comment: "Keskinliği gerçekten iyi." }),
    review({ id: "grev_3", author: "Ayşe Demir", comment: "Üçüncü yorum." }),
  ],
}

// The page as read: React writes an apostrophe as an entity
const words = (html: string) => html.replaceAll("&#x27;", "'")
const home = (sections: HomeSectionView[]) =>
  words(renderPage(atolyeTheme, "HomePage", { view: { sections } }))

describe("the Google rating badge's view", () => {
  it("keeps Google's figures, links to the reviews page and Google, up to the excerpts asked", () => {
    const view = googleRatingView(section(), answer, t)

    expect(view).toMatchObject({
      id: "googlepuan",
      type: "google_rating",
      title: "Google'da bizi değerlendirenler",
      average: "4,6",
      rating: 4.6,
      label: "Google'da 5 üzerinden 4,6, 126 yorum",
      reviews: { label: "Google'da 126 değerlendirme", path: "/yorumlar" },
      profileUrl: "https://maps.google.com/maps?cid=1267",
    })
    expect(view?.excerpts).toHaveLength(2)
    expect(view?.excerpts[1]).toMatchObject({
      author: "Google kullanıcısı",
      rating: 4,
      ratingLabel: "5 üzerinden 4 yıldız",
    })
    expect(view?.excerpts[0]?.date).toEqual({
      label: "2 Kasım 2026",
      dateTime: "2026-11-02T09:00:00.000Z",
    })
  })

  it("takes the shop's title, no excerpts when off, no Google link when off or not https", () => {
    const own = googleRatingView(
      section({ title: "Google'da biz", excerpts: 0, profile_link: false }),
      answer,
      t
    )
    const plainLink = googleRatingView(section(), { ...answer, maps_url: "http://maps.x" }, t)

    expect(own).toMatchObject({ title: "Google'da biz", excerpts: [], profileUrl: null })
    expect(plainLink?.profileUrl).toBeNull()
  })

  it("leaves out an excerpt under four stars or without text, whatever the answer holds", () => {
    const view = googleRatingView(
      section({ excerpts: 3 }),
      {
        ...answer,
        reviews: [review({ rating: 3 }), review({ comment: "   " }), review({ comment: null })],
      },
      t
    )
    expect(view?.excerpts).toEqual([])
  })

  it("is none when not connected, without an average or without reviews", () => {
    expect(googleRatingView(section(), null, t)).toBeNull()
    expect(googleRatingView(section(), undefined, t)).toBeNull()
    expect(googleRatingView(section(), { ...answer, rating: null }, t)).toBeNull()
    expect(googleRatingView(section(), { ...answer, count: 0, reviews: [] }, t)).toBeNull()
  })
})

describe("the themes' Google rating badge", () => {
  const badge = googleRatingView(section(), answer, t)
  if (!badge) {
    throw new Error("no badge")
  }

  it("Atölye: the average, the stars, the links, the excerpts quoted; never structured data", () => {
    const html = home([badge])

    expect(html).toContain("Google'da bizi değerlendirenler")
    expect(html).toContain(">4,6<")
    expect(html).toContain("Google'da 5 üzerinden 4,6, 126 yorum")
    expect(html).toContain('href="/yorumlar"')
    expect(html).toContain("Google'da 126 değerlendirme")
    expect(html).toContain('href="https://maps.google.com/maps?cid=1267"')
    expect(html).toMatch(/target="_blank" rel="noopener noreferrer"/)
    // The first sentence of each excerpt, quoted
    expect(html).toContain("“Şam çeliği av bıçağı aldım. Kılıfı gerçek deri, dikişleri çok temiz.”")
    expect(html).toContain("Google kullanıcısı")
    expect(html).toContain(`aria-label="Google'dan son değerlendirmeler"`)
    expect(html).not.toContain("application/ld+json")
    expect(html).not.toContain("itemprop")
    expect(html).not.toContain("style=")
  })

  it("Atölye without excerpts or the Google link: the well alone", () => {
    const bare = googleRatingView(section({ excerpts: 0, profile_link: false }), answer, t)
    const html = home(bare ? [bare] : [])

    expect(html).toContain("Google'da 126 değerlendirme")
    expect(html).not.toContain("maps.google.com")
    expect(html).not.toContain("<blockquote")
  })
})
