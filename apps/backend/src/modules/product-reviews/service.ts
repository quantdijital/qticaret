import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { ProductRating } from "./models/product-rating"
import { ProductReview } from "./models/product-review"
import { ProductReviewPhoto } from "./models/product-review-photo"
import { setReviewPhotos } from "./photos"
import type { RemovedPhoto } from "./photos"
import { approvedStarCounts, decideReview, starCounts } from "./statements"
import type { MigratedReview, Rating, RatingDistribution, ReviewInput, ReviewReply } from "./types"

export type { MigratedReview, Rating, RatingDistribution, ReviewInput, ReviewReply } from "./types"

/** Product reviews (F10.6, adr/0037 §4): written, moderated, summed; their photos. */
class ProductReviewsModuleService extends MedusaService({
  ProductReview,
  ProductRating,
  // Named for its methods (`listReviewImages`): Medusa would pluralise "Photo" as "Photoes"
  ReviewImage: ProductReviewPhoto,
}) {
  /**
   * Writes the customer's review of the product, or changes it; either way
   * it waits for the shop. `photo_ids`, when given, become its photos in
   * the same transaction (left out: the photos stay); the ones it drops
   * come back for their files to be removed.
   */
  async writeReview(input: ReviewInput): Promise<{ id: string; removed: RemovedPhoto[] }> {
    try {
      return await this.writeReview_(input)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("product_id")) {
        throw error
      }
      return this.writeReview_(input)
    }
  }

  @InjectTransactionManager()
  protected async writeReview_(
    { photo_ids: photoIds, ...input }: ReviewInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; removed: RemovedPhoto[] }> {
    const [existing] = await this.listProductReviews(
      { product_id: input.product_id, customer_id: input.customer_id },
      { take: 1, select: ["id", "status"] },
      sharedContext
    )
    const photos = (reviewId: string) =>
      photoIds === undefined
        ? Promise.resolve([])
        : setReviewPhotos(
            this,
            {
              review_id: reviewId,
              product_id: input.product_id,
              customer_id: input.customer_id,
              photo_ids: photoIds,
            },
            sharedContext
          )
    const values = {
      ...input,
      // One migrated, written again here, is now the purchase verified here
      origin: "storefront" as const,
      status: "pending" as const,
      reject_reason: null,
      moderated_by: null,
      moderated_at: null,
    }
    if (!existing) {
      const created = await this.createProductReviews(values, sharedContext)
      return { id: created.id, removed: await photos(created.id) }
    }
    await this.updateProductReviews({ id: existing.id, ...values }, sharedContext)
    const removed = await photos(existing.id)
    // A changed review leaves the stars until the shop approves it again
    if (existing.status === "approved") {
      await this.recountRating_(input.product_id, sharedContext)
    }
    return { id: existing.id, removed }
  }

  /**
   * Approves or rejects reviews as staff saw them, and sums each touched
   * product's approved ones again. One whose author changed it since
   * (`updated_at` moved) is left as it is and returned in `changed`: each
   * is decided in one conditional statement, so new text never goes out
   * on an approval of the old (security review 2026-10-29).
   */
  @InjectTransactionManager()
  async moderate(
    input: {
      reviews: { id: string; updated_at: string }[]
      status: "approved" | "rejected"
      by: string
      reason?: string | null
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ products: string[]; changed: string[] }> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("product-reviews: moderation runs in a transaction")
    }
    const now = new Date()
    const decided: { id: string; product_id: string }[] = []
    const changed: string[] = []
    for (const review of input.reviews) {
      const row = await decideReview(manager, review, input, now)
      if (row) {
        decided.push(row)
      } else {
        changed.push(review.id)
      }
    }
    const products = [...new Set(decided.map((review) => review.product_id))]
    for (const productId of products) {
      await this.recountRating_(productId, sharedContext)
    }
    return { products, changed }
  }

  /**
   * Reviews brought from the shop's old platform (F14, adr/0042), dated as
   * they were written; the stars of the products they touch summed again.
   */
  @InjectTransactionManager()
  async addMigratedReviews(
    reviews: readonly MigratedReview[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    if (reviews.length === 0) {
      return []
    }
    // Written by a run that stopped before it noted them: the same rows, not new ones
    const written = new Map(
      (
        await this.listProductReviews(
          { source_ref: reviews.map((review) => review.source_ref) },
          { select: ["id", "source_ref"] },
          sharedContext
        )
      ).map((row) => [row.source_ref ?? "", row.id])
    )
    const fresh = reviews.filter((review) => !written.has(review.source_ref))
    const approved = (review: MigratedReview) => review.published && !review.has_link
    const created = await this.createProductReviews(
      fresh.map((review) => ({
        source_ref: review.source_ref,
        product_id: review.product_id,
        customer_id: review.customer_id,
        order_id: null,
        rating: review.rating,
        title: review.title,
        body: review.body,
        author_name: review.author_name,
        has_link: review.has_link,
        origin: "migration" as const,
        status: approved(review) ? ("approved" as const) : ("pending" as const),
        created_at: review.created_at,
      })),
      sharedContext
    )
    const touched = new Set(fresh.filter(approved).map((review) => review.product_id))
    for (const productId of touched) {
      await this.recountRating_(productId, sharedContext)
    }
    created.forEach((row, index) => {
      written.set(fresh[index]?.source_ref ?? "", row.id)
    })
    return reviews.map((review) => written.get(review.source_ref) ?? "")
  }

  /**
   * Writes the shop's reply to a review, or removes it (all null), and
   * gives back the reply it had: a workflow puts that back on an undo.
   */
  @InjectTransactionManager()
  async setReply(
    id: string,
    reply: ReviewReply,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReviewReply> {
    const before = await this.retrieveProductReview(
      id,
      { select: ["id", "reply", "replied_by", "replied_at"] },
      sharedContext
    )
    await this.updateProductReviews({ id, ...reply }, sharedContext)
    return {
      reply: before.reply,
      replied_by: before.replied_by,
      replied_at: before.replied_at ? new Date(before.replied_at) : null,
    }
  }

  /** Each product's average and count of approved reviews; none for a product without one. */
  @InjectManager()
  async ratingsOf(
    productIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, Rating>> {
    const rows = await this.listProductRatings(
      { product_id: productIds },
      { select: ["product_id", "review_count", "rating_total"] },
      sharedContext
    )
    return new Map(
      rows
        .filter((row) => row.review_count > 0)
        .map((row) => [
          row.product_id,
          {
            average: Math.round((row.rating_total / row.review_count) * 10) / 10,
            count: row.review_count,
          },
        ])
    )
  }

  /** How many approved reviews of the product gave each number of stars (adr/0046 Ek 2026-11-04). */
  @InjectManager()
  async ratingDistribution(
    productId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RatingDistribution> {
    return starCounts(sharedContext.manager as EntityManager, productId)
  }

  /** How many approved reviews each product has per number of stars: the shop-wide spread's rows. */
  @InjectManager()
  async approvedRatingCounts(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ product_id: string; rating: number; count: number }[]> {
    return approvedStarCounts(sharedContext.manager as EntityManager)
  }

  @InjectTransactionManager()
  protected async recountRating_(
    productId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const approved = await this.listProductReviews(
      { product_id: productId, status: "approved" },
      { select: ["rating"] },
      sharedContext
    )
    const values = {
      review_count: approved.length,
      rating_total: approved.reduce((sum, review) => sum + review.rating, 0),
    }
    const [row] = await this.listProductRatings(
      { product_id: productId },
      { take: 1, select: ["id"] },
      sharedContext
    )
    if (row) {
      await this.updateProductRatings({ id: row.id, ...values }, sharedContext)
    } else {
      await this.createProductRatings({ product_id: productId, ...values }, sharedContext)
    }
  }
}

export default ProductReviewsModuleService
