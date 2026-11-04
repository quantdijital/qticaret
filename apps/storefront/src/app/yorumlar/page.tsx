import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { StoreReviewPhoto } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { breadcrumbJsonLd } from "@/lib/seo/breadcrumbs"
import { JsonLd } from "@/lib/seo/JsonLd"
import { isStoreApiError } from "@/lib/store-api/errors"
import { pathsOf, siteSeo } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { reviewPhotos } from "@/lib/views/card-extras"
import { theme } from "@/theme"

const PAGE_SIZE = 20
const pagePath = (page: number) => (page > 1 ? `/yorumlar?sayfa=${String(page)}` : "/yorumlar")
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
  }[]
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
  return {
    title: { absolute: `${t("reviews.title")} | ${site.shop.name}` },
    description: t("reviews.description", { shop: site.shop.name }),
    alternates: site.canonical_host
      ? { canonical: `https://${site.canonical_host}${pagePath(page)}` }
      : null,
    robots: site.indexing ? "index,follow" : "noindex,nofollow",
  }
}

/** `/yorumlar` (D10): every approved review, twenty a page, each with its product's link. */
export default async function ReviewsIndex({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, site] = await Promise.all([searchParams, siteSeo()])
  const page = pageOf(query)
  if (page === null) {
    notFound()
  }
  let answer: Answer
  try {
    answer = await storeGet<Answer>("/store/reviews", {
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
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
  const paths = await pathsOf(
    "product",
    answer.reviews.map((review) => review.product_id)
  )
  const average =
    answer.reviews.length > 0
      ? Math.round(
          (answer.reviews.reduce((sum, review) => sum + review.rating, 0) / answer.reviews.length) *
            10
        ) / 10
      : null
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
          average,
          count: answer.count,
          reviews: answer.reviews.map((review) => {
            const path = paths[review.product_id]
            const author = review.author_name ?? t("product.anonymous")
            return {
              rating: review.rating,
              title: review.title,
              body: review.body,
              author,
              date: DATE.format(new Date(review.created_at)),
              verified: review.verified_purchase,
              photos: reviewPhotos(review.photos, author, t),
              product: path ? { label: review.product_title, path } : null,
            }
          }),
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
