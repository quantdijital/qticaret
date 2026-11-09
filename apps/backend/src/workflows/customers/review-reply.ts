import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import type { ReviewReply } from "../../modules/product-reviews/service"

/**
 * The shop's public reply to a product review from the panel, as a
 * product question's shop answer: written to an approved review only
 * (the storefront shows no other), changed or removed at any time. It
 * waits for no one and tells no one (a shop answer to a question sends
 * nothing either). A review its author changes goes back to waiting with
 * its reply kept, shown again once approved. The route's audit entry
 * records it (`product_review`: whether, how long, who, when; not the words).
 */

export interface ReplyToReviewInput {
  id: string
  /** The reply's text as validated; null removes it. */
  reply: string | null
  user_id: string
}

/** The reply as it now stands, its time as text between steps. */
export interface ReviewReplyResult {
  id: string
  reply: string | null
  replied_at: string | null
}

const reviewsOf = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)

/**
 * Why the reply cannot be written as asked, as an error key; null when it
 * can. A reply goes on an approved review only; a removal needs one.
 */
export function replyRefusal(
  review: { status: string; reply: string | null },
  reply: string | null
): string | null {
  if (reply === null) {
    return review.reply === null ? "reviews.reply_missing" : null
  }
  return review.status === "approved" ? null : "reviews.reply_not_approved"
}

interface Undo {
  id: string
  previous: { reply: string | null; replied_by: string | null; replied_at: string | null }
}

/** Writes the reply (or removes it); undone by putting back the one before. */
const setReviewReplyStep = createStep(
  "product-review-reply-set",
  async (input: ReplyToReviewInput, { container }) => {
    const reviews = reviewsOf(container)
    const [review] = await reviews.listProductReviews(
      { id: input.id },
      { take: 1, select: ["id", "status", "reply"] }
    )
    if (!review) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "reviews.unknown")
    }
    const refusal = replyRefusal(review, input.reply)
    if (refusal) {
      throw new ValidationError(refusal, { field: "body" })
    }
    const now = new Date()
    const next: ReviewReply =
      input.reply === null
        ? { reply: null, replied_by: null, replied_at: null }
        : { reply: input.reply, replied_by: input.user_id, replied_at: now }
    const previous = await reviews.setReply(input.id, next)
    return new StepResponse<ReviewReplyResult, Undo>(
      { id: input.id, reply: next.reply, replied_at: next.replied_at?.toISOString() ?? null },
      {
        id: input.id,
        previous: { ...previous, replied_at: previous.replied_at?.toISOString() ?? null },
      }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const { reply, replied_by, replied_at } = undo.previous
    await reviewsOf(container).setReply(undo.id, {
      reply,
      replied_by,
      replied_at: replied_at ? new Date(replied_at) : null,
    })
  }
)

export const replyToReviewWorkflow = createWorkflow(
  "product-review-reply",
  (input: ReplyToReviewInput) => new WorkflowResponse(setReviewReplyStep(input))
)
