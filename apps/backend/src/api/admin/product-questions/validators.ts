import { z } from "@medusajs/framework/zod"

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

export const AdminGetQuestions = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AdminGetQuestionsType = z.infer<typeof AdminGetQuestions>

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
