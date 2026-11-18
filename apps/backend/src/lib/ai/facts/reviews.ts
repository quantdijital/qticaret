import { PRODUCT_QA_MODULE } from "../../../modules/product-qa"
import type ProductQaModuleService from "../../../modules/product-qa/service"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../modules/product-reviews/service"
import { aiValidationError } from "../errors"
import { maskNames } from "../mask-names"
import { REVIEW_SUMMARY_MAX_REVIEWS, REVIEW_SUMMARY_MIN_REVIEWS } from "../registry/tasks"
import { readProductFacts } from "./product"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What customers wrote, as it may leave the shop (adr/0071 §10; Aşama 9):
 * a rating and the words, each author's name masked in them. The columns
 * read are named and none of them is the author's name as a fact, an id
 * of a customer or an order, or a contact: the name is read only to mask
 * it, and the pattern filter (lib/ai/prompt.ts) then takes out what reads
 * as an e-mail, a phone number, an IBAN, a card or an identity number.
 */

const stars = (rating: number) => `${String(rating)}/5`

/** A review's title and text as one value; the title, when there is one, first. */
const reviewWords = (title: string | null, body: string) =>
  title && title.trim() !== "" ? `${title.trim()}. ${body}` : body

const productName = async (container: FactsContainer, productId: string) =>
  (await readProductFacts(container, productId))?.name ?? null

/**
 * A product's approved reviews for a summary: the newest
 * `REVIEW_SUMMARY_MAX_REVIEWS`, each a rating and its words. A product with
 * fewer than `REVIEW_SUMMARY_MIN_REVIEWS` is turned away before any quota
 * is claimed (`ai.not_enough_reviews`).
 */
export async function productReviewFacts(
  container: FactsContainer,
  productId: string
): Promise<RecordFacts> {
  const name = await productName(container, productId)
  if (name === null) {
    throw aiValidationError("ai.unknown_entity")
  }
  const [rows, count] = await container
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listAndCountProductReviews(
      { product_id: productId, status: "approved" },
      {
        take: REVIEW_SUMMARY_MAX_REVIEWS,
        order: { created_at: "DESC" },
        select: ["id", "rating", "title", "body", "author_name"],
      }
    )
  if (rows.length < REVIEW_SUMMARY_MIN_REVIEWS) {
    throw aiValidationError("ai.not_enough_reviews")
  }
  // Every author's name is masked in every review: one may name another
  const authors = rows.map((row) => row.author_name)
  return {
    product: name,
    review_count: String(count),
    reviews: rows.map((row) => ({
      label: stars(row.rating),
      value: maskNames(reviewWords(row.title, row.body), authors),
    })),
  }
}

/** One approved review for a reply draft: its rating and words, and the product's name. */
export async function reviewFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const [row] = await container
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listProductReviews(
      { id, status: "approved" },
      { take: 1, select: ["id", "product_id", "rating", "title", "body", "author_name"] }
    )
  if (!row) {
    throw aiValidationError("ai.unknown_entity")
  }
  return {
    product: await productName(container, row.product_id),
    rating: stars(row.rating),
    review: maskNames(reviewWords(row.title, row.body), [row.author_name]),
  }
}

/**
 * A question not turned down, for an answer draft: its words, and the
 * product's published fields the answer may stand on (lib/ai/facts/product).
 */
export async function questionFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const [row] = await container
    .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
    .listProductQuestions(
      { id, status: ["pending", "approved"] },
      { take: 1, select: ["id", "product_id", "body", "author_name"] }
    )
  if (!row) {
    throw aiValidationError("ai.unknown_entity")
  }
  const product = await readProductFacts(container, row.product_id)
  return {
    ...(product ?? {}),
    question: maskNames(row.body, [row.author_name]),
  }
}
