import type { SourceReview } from "../../types"
import type { WordpressContext } from "./context"
import { note } from "./context"
import { bodyBlocks, plainText } from "./html"
import type { WxrItem } from "./reader"

/**
 * WooCommerce reviews: a product's comments with a star rating (1–5).
 * Approved ones were shown there and are shown here; waiting ones wait;
 * spam and the trash are left out. The writer moves by name only: the
 * export's e-mail and IP address are never read (the run brings no
 * customers to tie a review to). Photos a review plugin kept do not move.
 */

const MAX_BODY = 10_000

export function reviewsOf(context: WordpressContext, product: WxrItem): SourceReview[] {
  const reviews: SourceReview[] = []
  for (const comment of product.comments) {
    const key = `comment:${comment.id}`
    if (comment.approved !== "1" && comment.approved !== "0") {
      continue
    }
    const rating = Number(comment.meta.get("rating") ?? "")
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.date === null) {
      note(context, "review", key, "migration.wordpress_comment_not_review")
      continue
    }
    if ((comment.meta.get("reviews-images") ?? "").trim() !== "") {
      note(context, "review", key, "migration.wordpress_review_photos")
    }
    const body = plainText(bodyBlocks(comment.content.replace(/\r?\n/g, "<br>")).blocks, MAX_BODY)
    reviews.push({
      source_key: key,
      product_source_key: `product:${product.id}`,
      author: comment.author.slice(0, 255) || null,
      customer_email: null,
      rating,
      title: null,
      body: body.text,
      published: comment.approved === "1",
      created_at: comment.date,
    })
  }
  return reviews
}
