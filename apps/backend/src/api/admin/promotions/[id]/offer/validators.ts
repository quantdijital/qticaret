import { z } from "@medusajs/framework/zod"
import { CODE_PATTERN, normalizeCode } from "../../../../../lib/promotions"

const Rule = z
  .object({
    attribute: z.string().min(1).max(100),
    operator: z.enum(["in", "gte"]),
    values: z.array(z.string().min(1).max(200)).min(1).max(500),
  })
  .strict()

const Day = z.iso.datetime({ offset: true }).nullable()

/**
 * A promotion's changes from the panel's form (F4.4/F4.5), each part only
 * when it changed. The code is kept in the shop's form and refused if it
 * is not one (ADR-0024).
 */
export const AdminPostPromotionOffer = z
  .object({
    promotion: z
      .object({
        code: z
          .string()
          .transform(normalizeCode)
          .refine((code) => CODE_PATTERN.test(code), { message: "promotions.code_invalid" }),
        is_automatic: z.boolean(),
        limit: z.number().int().positive().nullable(),
        application_method: z
          .object({
            value: z.number().positive(),
            apply_to_quantity: z.number().int().positive().optional(),
            buy_rules_min_quantity: z.number().int().positive().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    scope: z
      .object({
        target_type: z.enum(["items", "order"]),
        target_rules: z.array(Rule).max(20),
        buy_rules: z.array(Rule).max(20).optional(),
      })
      .strict()
      .optional(),
    minimum: z.array(Rule).max(5).optional(),
    per_customer: z.object({ limit: z.number().int().positive().nullable() }).strict().optional(),
    dates: z.object({ starts_at: Day, ends_at: Day }).strict().optional(),
    campaign: z
      .object({
        name: z.string().min(1).max(200),
        campaign_identifier: z.string().min(1).max(200),
        starts_at: Day,
        ends_at: Day,
        budget: z
          .object({
            type: z.literal("use_by_attribute"),
            attribute: z.literal("customer_id"),
            limit: z.number().int().positive().nullable(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
export type AdminPostPromotionOfferType = z.infer<typeof AdminPostPromotionOffer>
