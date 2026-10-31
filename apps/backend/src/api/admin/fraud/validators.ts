import { z } from "@medusajs/framework/zod"

export const AdminGetFraudReviews = z
  .object({
    status: z.enum(["pending", "approved", "rejected"]).default("pending"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict()
export type AdminGetFraudReviewsType = z.infer<typeof AdminGetFraudReviews>

/** A person's decision on a held order; a note for the next person, never the buyer's data. */
export const AdminPostFraudDecision = z
  .object({
    status: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(500).nullish(),
  })
  .strict()
export type AdminPostFraudDecisionType = z.infer<typeof AdminPostFraudDecision>

export const AdminGetFraudBlocks = z
  .object({
    kind: z.enum(["email", "email_domain", "phone", "ip"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict()
export type AdminGetFraudBlocksType = z.infer<typeof AdminGetFraudBlocks>

/** An entry: the value as typed (an e-mail or a phone is kept only as its keyed hash). */
export const AdminPostFraudBlock = z
  .object({
    kind: z.enum(["email", "email_domain", "phone", "ip"]),
    value: z.string().trim().min(1).max(320),
    reason: z.string().trim().max(500).nullish(),
    expires_at: z.coerce.date().nullish(),
  })
  .strict()
export type AdminPostFraudBlockType = z.infer<typeof AdminPostFraudBlock>
