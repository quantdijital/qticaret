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

export interface ReviewInput {
  product_id: string
  customer_id: string
  order_id: string
  rating: number
  title: string | null
  body: string
  author_name: string
  has_link: boolean
}

/** A review the shop's old platform showed (F14), as it was. */
export interface MigratedReview {
  product_id: string
  customer_id: string | null
  rating: number
  title: string | null
  body: string
  author_name: string
  has_link: boolean
  /** Shown on the old site: approved here; one waiting there waits here. */
  published: boolean
  created_at: Date
}

export interface Rating {
  average: number
  count: number
}

/** Product reviews (F10.6, adr/0037 §4): written, moderated, summed. */
class ProductReviewsModuleService extends MedusaService({ ProductReview, ProductRating }) {
  /** Writes the customer's review of the product, or changes it; either way it waits for the shop. */
  async writeReview(input: ReviewInput): Promise<{ id: string }> {
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
    input: ReviewInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string }> {
    const [existing] = await this.listProductReviews(
      { product_id: input.product_id, customer_id: input.customer_id },
      { take: 1, select: ["id", "status"] },
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
      return { id: created.id }
    }
    await this.updateProductReviews({ id: existing.id, ...values }, sharedContext)
    // A changed review leaves the stars until the shop approves it again
    if (existing.status === "approved") {
      await this.recountRating_(input.product_id, sharedContext)
    }
    return { id: existing.id }
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
      const [row] = await manager.execute<{ id: string; product_id: string }[]>(
        `UPDATE product_review
         SET status = ?, reject_reason = ?, moderated_by = ?, moderated_at = ?, updated_at = ?
         WHERE id = ? AND updated_at = ? AND deleted_at IS NULL
         RETURNING id, product_id`,
        [
          input.status,
          input.status === "rejected" ? (input.reason ?? null) : null,
          input.by,
          now,
          now,
          review.id,
          new Date(review.updated_at),
        ]
      )
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
    const created = await this.createProductReviews(
      reviews.map((review) => ({
        product_id: review.product_id,
        customer_id: review.customer_id,
        order_id: null,
        rating: review.rating,
        title: review.title,
        body: review.body,
        author_name: review.author_name,
        has_link: review.has_link,
        origin: "migration" as const,
        status: review.published ? ("approved" as const) : ("pending" as const),
        created_at: review.created_at,
      })),
      sharedContext
    )
    const touched = new Set(
      reviews.filter((review) => review.published).map((review) => review.product_id)
    )
    for (const productId of touched) {
      await this.recountRating_(productId, sharedContext)
    }
    return created.map((review) => review.id)
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
