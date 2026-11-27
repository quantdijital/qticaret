import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { StoreGoogleReview, StoreReviewPhoto, StoreReviewReply } from "@qticaret/types"
import type { ReviewsPageItemView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { breadcrumbJsonLd } from "@/lib/seo/breadcrumbs"
import { pageTitle } from "@/lib/seo/paging"
import { JsonLd } from "@/lib/seo/JsonLd"
import { isStoreApiError } from "@/lib/store-api/errors"
import { pathsOf, siteSeo } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { googleReviews, reviewSummary } from "@/lib/store-api/extras"
import { reviewPhotos, reviewReply, shopRatingView } from "@/lib/views/card-extras"
import { byDate, googleReviewItem, googleReviewsView } from "@/lib/views/google-reviews"
import { reviewFilterView, reviewsPath, starsOf } from "@/lib/views/review-filter"
import { reviewedProductPictures } from "@/lib/views/review-cards"
import { theme } from "@/theme"

const PAGE_SIZE = 20
const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

interface Answer {
  reviews: {
    product_id: string
    product_title: string
    rating: number
    title: string | null
    body: string
    author_name: string | null
    created_at: string
    verified_purchase: boolean
    photos?: StoreReviewPhoto[]
    reply?: StoreReviewReply | null
  }[]
  /** With `google=1`: the shop's Google reviews on this page (adr/0058 Ek 2026-11-27). */
  google_reviews?: StoreGoogleReview[]
  count: number
}

type Query = Record<string, string | string[] | undefined>

function pageOf(query: Query): number | null {
  const raw = query["sayfa"]
  if (raw === undefined) {
    return 1
  }
  return typeof raw === "string" && /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : null
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Query>
}): Promise<Metadata> {
  const [site, query] = await Promise.all([siteSeo(), searchParams])
  const page = pageOf(query) ?? 1
  // A star filter narrows the page as a listing's filter does (docs/13 §7):
  // out of the index, its links followed, the whole list its canonical
  const filtered = starsOf(query) !== undefined
  return {
    title: {
      absolute: pageTitle(`${t("reviews.title")} | ${site.shop.name}`, page, site.shop.name, t),
    },
    description: t("reviews.description", { shop: site.shop.name }),
    alternates: site.canonical_host
      ? { canonical: `https://${site.canonical_host}${reviewsPath(filtered ? 1 : page)}` }
      : null,
    robots: !site.indexing ? "noindex,nofollow" : filtered ? "noindex,follow" : "index,follow",
  }
}

/**
 * `/yorumlar` (D10): every approved review, twenty a page, each with its
 * product's link, mixed by date with the shop's Google reviews, each of
 * those with its link on Google (adr/0058 Ek 2026-11-27); Google's own
 * average and count beside the shop's, never added to them, and none of
 * Google's in structured data. `?puan=5` the shop's five-star ones alone
 * (adr/0037 Ek 2026-11-05), the shop-wide spread its links.
 */
export default async function ReviewsIndex({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, site] = await Promise.all([searchParams, siteSeo()])
  const page = pageOf(query)
  const asked = starsOf(query)
  if (page === null || asked === null) {
    notFound()
  }
  const stars = asked ?? null
  const pagePath = (number: number) => reviewsPath(number, stars)
  let answer: Answer
  try {
    answer = await storeGet<Answer>("/store/reviews", {
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      // Google's reviews only among every review: the star filter and its spread are the shop's
      ...(stars === null ? { google: "1" } : { rating: stars }),
    })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    answer = { reviews: [], count: 0 }
  }
  const pages = Math.max(1, Math.ceil(answer.count / PAGE_SIZE))
  if (page > pages) {
    notFound()
  }
  const ids = [...new Set(answer.reviews.map((review) => review.product_id))]
  const [paths, rating, pictures, fromGoogle] = await Promise.all([
    pathsOf("product", ids),
    // The shop-wide average and spread (adr/0046 Ek 2026-11-05), not this page's
    reviewSummary(),
    reviewedProductPictures(ids),
    // adr/0058: Google's own figures and links, beside the shop's (its reviews are in the list)
    stars === null ? googleReviews(0) : Promise.resolve(null),
  ])
  const summary = shopRatingView(rating, t)
  const filter = reviewFilterView(summary, stars, t)
  const google = googleReviewsView(fromGoogle, t)
  const shopCards = answer.reviews.map((review) => {
    const path = paths[review.product_id]
    const author = review.author_name ?? t("product.anonymous")
    const item: ReviewsPageItemView = {
      rating: review.rating,
      title: review.title,
      body: review.body,
      author,
      date: DATE.format(new Date(review.created_at)),
      verified: review.verified_purchase,
      photos: reviewPhotos(review.photos, author, t),
      reply: reviewReply(review.reply),
      product: path
        ? {
            label: review.product_title,
            path,
            image: pictures.get(review.product_id) ?? null,
          }
        : null,
    }
    return { at: review.created_at, item }
  })
  const googleCards = (answer.google_reviews ?? []).flatMap((review) => {
    const item = googleReviewItem(review, fromGoogle?.maps_url ?? null, site.shop.name, t)
    return item ? [{ at: review.created_at, item }] : []
  })
  const reviews = byDate(shopCards, googleCards)
  return (
    <>
      <JsonLd
        blocks={breadcrumbJsonLd(site.canonical_host, [
          { name: t("home.label"), path: "/" },
          { name: t("reviews.title"), path: "/yorumlar" },
        ])}
      />
      <theme.ReviewsPage
        t={t}
        view={{
          title: t("reviews.title"),
          breadcrumbs: [
            { label: t("home.label"), path: "/" },
            { label: t("reviews.title"), path: null },
          ],
          average: rating?.average ?? null,
          // Shop-wide: a filtered page's own count is its pages'
          count: rating?.count ?? (stars === null ? answer.count : 0),
          ...(summary ? { summary } : {}),
          ...(filter ? { filter } : {}),
          ...(google ? { google } : {}),
          reviews,
          pagination: {
            page,
            pages,
            previous: page > 1 ? pagePath(page - 1) : null,
            next: page < pages ? pagePath(page + 1) : null,
            pagePath: Object.fromEntries(
              Array.from({ length: Math.min(pages, 50) }, (_, index) => [
                index + 1,
                pagePath(index + 1),
              ])
            ),
          },
        }}
      />
    </>
  )
}
