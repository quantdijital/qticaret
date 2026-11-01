import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { isStoreApiError } from "@/lib/store-api/errors"
import { pathsOf, siteSeo } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
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
    alternates: site.canonical_host
      ? { canonical: `https://${site.canonical_host}${pagePath(page)}` }
      : null,
    robots: site.indexing ? "index,follow" : "noindex,nofollow",
  }
}

/** `/yorumlar` (D10): every approved review, twenty a page, each with its product's link. */
export default async function ReviewsIndex({ searchParams }: { searchParams: Promise<Query> }) {
  const page = pageOf(await searchParams)
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
          return {
            rating: review.rating,
            title: review.title,
            body: review.body,
            author: review.author_name ?? t("product.anonymous"),
            date: DATE.format(new Date(review.created_at)),
            verified: review.verified_purchase,
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
  )
}
