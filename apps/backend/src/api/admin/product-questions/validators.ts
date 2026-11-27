import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../lib/security/text"

/** Text as typed, without control characters other than line breaks (a reply to a review too). */
export const plainText = (value: string): string => value.replace(/[^\P{Cc}\n]/gu, "").trim()

/** A question or an answer: a few words to a short paragraph. */
export const qaText = z.string().transform(plainText).pipe(z.string().min(10).max(1000))

export const StorePostQaText = z.object({ body: qaText }).strict()
export type StorePostQaTextType = z.infer<typeof StorePostQaText>

export const StoreGetQuestions = z.object({
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
export type StoreGetQuestionsType = z.infer<typeof StoreGetQuestions>

const moderation = (prefix: string) =>
  z
    .object({
      ids: z
        .array(z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{1,40}$`)))
        .min(1)
        .max(100),
      status: z.enum(["approved", "rejected"]),
    })
    .strict()

export const AdminModerateQuestions = moderation("pq")
export type AdminModerateQuestionsType = z.infer<typeof AdminModerateQuestions>
export const AdminModerateAnswers = moderation("pans")
export type AdminModerateAnswersType = z.infer<typeof AdminModerateAnswers>

/**
 * A product's questions in the panel: `product_id` lists that product's,
 * every state (newest first), unless `status` names one; without it, the
 * moderation queue by state (waiting by default).
 */
export const AdminGetQuestions = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  product_id: z
    .string()
    .regex(/^prod_[A-Za-z0-9]{1,40}$/)
    .optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AdminGetQuestionsType = z.infer<typeof AdminGetQuestions>

/** The shop's own words on a question: a few characters to a short paragraph, plain text. */
export const shopQaText = z
  .string()
  // Invisible format characters too (direction overrides, zero widths): the text reads as stored
  .transform((value) => plainText(value.replace(/\p{Cf}/gu, "")))
  .pipe(z.string().min(2).max(1000))
  .refine((value) => isCleanText(value.replace(/\n/g, " ")), { message: "questions.text_invalid" })

/** A question and its answer the shop adds to a product by hand, published at once. */
export const AdminPostShopQuestion = z
  .object({
    product_id: z.string().regex(/^prod_[A-Za-z0-9]{1,40}$/),
    question: shopQaText,
    answer: shopQaText,
  })
  .strict()
export type AdminPostShopQuestionType = z.infer<typeof AdminPostShopQuestion>

/** A question's words and the shop's answer changed; `answer: null` removes the shop's answer. */
export const AdminPostQuestionEdit = z
  .object({
    body: shopQaText.optional(),
    answer: shopQaText.nullable().optional(),
  })
  .strict()
  .refine((value) => value.body !== undefined || value.answer !== undefined, {
    message: "questions.edit_empty",
  })
export type AdminPostQuestionEditType = z.infer<typeof AdminPostQuestionEdit>
