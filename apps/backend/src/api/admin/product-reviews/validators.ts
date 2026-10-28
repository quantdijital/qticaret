import { z } from "@medusajs/framework/zod"

export const AdminGetReviews = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AdminGetReviewsType = z.infer<typeof AdminGetReviews>

/** Reviews approved or rejected at once; a rejection may say why (for the shop's own record). */
export const AdminPostModerateReviews = z
  .object({
    ids: z
      .array(z.string().regex(/^prev_[A-Za-z0-9]{1,40}$/))
      .min(1)
      .max(100),
    status: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(200).optional(),
  })
  .strict()
export type AdminPostModerateReviewsType = z.infer<typeof AdminPostModerateReviews>
