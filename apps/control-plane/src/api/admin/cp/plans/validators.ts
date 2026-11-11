import { z } from "@medusajs/framework/zod"
import { BILLING_PERIODS, LIMIT_KEYS } from "@qticaret/types/control-plane"
import { limitValue } from "../tenants/validators"

const CLEAN = /^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u

const name = z.string().trim().min(1, "cp.name_required").max(100).regex(CLEAN, "cp.name_invalid")

/** Kuruş, TRY: up to one million lira a period. */
const price = z.number().int().min(0).max(100_000_000)
const days = (max: number) => z.number().int().min(0).max(max)

/** Any of the registry's limits; a key not in it is refused. */
const limits = z.partialRecord(z.enum(LIMIT_KEYS), limitValue)

/** A new package: its code (fixed: the plan document names it), name, price and limits. */
export const PostPlan = z
  .object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9-]{1,39}$/, "cp.package_code_invalid"),
    name,
    price,
    period: z.enum(BILLING_PERIODS),
    trial_days: days(365).default(0),
    grace_days: days(90).default(7),
    limits: limits.default({}),
  })
  .strict()
export type PostPlanType = z.infer<typeof PostPlan>

/** A package's name, days and limits; its price apart (a step-up, adr/0061 §3.5). */
export const PostPlanUpdate = z
  .object({
    name: name.optional(),
    trial_days: days(365).optional(),
    grace_days: days(90).optional(),
    limits: limits.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "cp.nothing_to_save")
export type PostPlanUpdateType = z.infer<typeof PostPlanUpdate>

/** A package's price and period: from the next period on (adr/0061 §7). */
export const PostPlanPrice = z.object({ price, period: z.enum(BILLING_PERIODS) }).strict()
export type PostPlanPriceType = z.infer<typeof PostPlanPrice>
