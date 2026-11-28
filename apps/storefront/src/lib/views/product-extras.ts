import "server-only"
import type { ProductCardView, QuestionsView, ReviewsView, Translate } from "@qticaret/ui"
import type { StoreProduct } from "@qticaret/types"
import { t as words } from "@/lib/i18n"
import { isStoreApiError } from "@/lib/store-api/errors"
import { cardFacts } from "@/lib/store-api/extras"
import {
  listProducts,
  pathsOf,
  priceDisplays,
  productQuestions,
  productReviews,
} from "@/lib/store-api/requests"
import { ratingBars, reviewPhotos, reviewReply, withCardFacts } from "./card-extras"
import { productCards, variantIdsOf } from "./product"
import { productsInOrder } from "./section-data"
import { cardOptions } from "./theme-settings"

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

/** A part of the page the backend could not answer is left empty, not the page. */
async function orEmpty<T>(load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isStoreApiError(error)) {
      return empty
    }
    throw error
  }
}

export async function reviewsView(productId: string, t: Translate): Promise<ReviewsView> {
  const answer = await orEmpty(() => productReviews(productId), {
    rating: null,
    reviews: [],
    count: 0,
  })
  return {
    average: answer.rating?.average ?? null,
    count: answer.rating?.count ?? answer.count,
    items: answer.reviews.map((review) => {
      const author = review.author_name ?? t("product.anonymous")
      return {
        rating: review.rating,
        title: review.title,
        body: review.body,
        author,
        date: DATE.format(new Date(review.created_at)),
        verified: review.verified_purchase,
        photos: reviewPhotos(review.photos, author, t),
        reply: reviewReply(review.reply),
      }
    }),
    distribution: ratingBars(answer.rating?.distribution, t),
  }
}

export async function questionsView(productId: string, t: Translate): Promise<QuestionsView> {
  const answer = await orEmpty(() => productQuestions(productId), { questions: [], count: 0 })
  return {
    count: answer.count,
    items: answer.questions.map((question) => ({
      body: question.body,
      author: question.author_name ?? t("product.anonymous"),
      date: DATE.format(new Date(question.created_at)),
      answers: question.answers.map((each) => ({
        body: each.body,
        author: each.by_shop
          ? t("product.shop_answer")
          : (each.author_name ?? t("product.anonymous")),
        byShop: each.by_shop,
      })),
    })),
  }
}

/** Up to four other products of the product's first category. */
async function categoryOthers(product: StoreProduct): Promise<StoreProduct[]> {
  const categoryId = product.categories?.[0]?.id
  if (!categoryId) {
    return []
  }
  const { products } = await orEmpty(() => listProducts({ categoryIds: [categoryId], limit: 5 }), {
    products: [],
    count: 0,
  })
  return products.filter((each) => each.id !== product.id).slice(0, 4)
}

/** The most of the shop's own linked products the fixed "similar products" shows (the theme's row). */
export const LINKED_SHOWN = 8

/**
 * The fixed "similar products": the shop's own linked products in its
 * order when it chose some still for sale (S3, at most eight), else up
 * to four other products of the product's first category, as before.
 */
export async function relatedOf(
  product: StoreProduct,
  upsellIds: readonly string[] = []
): Promise<ProductCardView[]> {
  const linked =
    upsellIds.length > 0
      ? await orEmpty(() => productsInOrder(upsellIds.slice(0, LINKED_SHOWN)), [])
      : []
  const others = linked.length > 0 ? linked : await categoryOthers(product)
  if (others.length === 0) {
    return []
  }
  const [paths, displays, options, facts] = await Promise.all([
    pathsOf(
      "product",
      others.map((each) => each.id)
    ),
    priceDisplays(variantIdsOf(others)),
    cardOptions(),
    cardFacts(others.map((each) => each.id)),
  ])
  return withCardFacts(productCards(others, paths, displays, options), facts, options, words)
}
