import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../lib/security/text"
import { plainText } from "../product-questions/validators"

/** The longest reply the shop writes under a review. */
export const REVIEW_REPLY_MAX = 1000

/** Reviews by state; `replied=false`, only those the shop has not replied to yet. */
export const AdminGetReviews = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  replied: z.enum(["true", "false"]).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AdminGetReviewsType = z.infer<typeof AdminGetReviews>

/**
 * Reviews approved or rejected at once, each as staff saw it (its
 * `updated_at` from the list); a rejection may say why (for the shop's
 * own record).
 */
export const AdminPostModerateReviews = z
  .object({
    reviews: z
      .array(
        z
          .object({
            id: z.string().regex(/^prev_[A-Za-z0-9]{1,40}$/),
            updated_at: z.iso.datetime({ offset: true }),
          })
          .strict()
      )
      .min(1)
      .max(100),
    status: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(200).optional(),
  })
  .strict()
export type AdminPostModerateReviewsType = z.infer<typeof AdminPostModerateReviews>

/**
 * The shop's reply to a review: plain text as a question's answer is
 * (control characters other than line breaks dropped, trimmed), at most
 * 1,000 characters. Refinements, not `.min`/`.max`: Medusa words a
 * length's refusal itself, not by our key.
 */
export const AdminPostReviewReply = z
  .object({
    body: z
      .string()
      .transform(plainText)
      .refine((value) => value.length > 0, { message: "reviews.reply_required" })
      .refine((value) => value.length <= REVIEW_REPLY_MAX, { message: "reviews.reply_too_long" })
      .refine((value) => isCleanText(value.replace(/\n/g, " ")), {
        message: "reviews.reply_invalid",
      }),
  })
  .strict()
export type AdminPostReviewReplyType = z.infer<typeof AdminPostReviewReply>
