import { z } from "@medusajs/framework/zod"
import {
  BILLING_PERIODS,
  GRANT_LIMIT_KEYS,
  GRANT_LIMIT_MAX,
  LIMIT_KEYS,
  isPlatformFlag,
} from "@qticaret/types/control-plane"
import { limitValue } from "../tenants/validators"

const CLEAN = /^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u

const name = z.string().trim().min(1, "cp.name_required").max(100).regex(CLEAN, "cp.name_invalid")

/** Kuruş, TRY: up to one million lira a period. */
const price = z.number().int().min(0).max(100_000_000)
const days = (max: number) => z.number().int().min(0).max(max)

/** Any of the registry's limits; a key not in it is refused, and a grant is never unlimited nor past its most. */
const limits = z.partialRecord(z.enum(LIMIT_KEYS), limitValue).superRefine((value, ctx) => {
  for (const key of GRANT_LIMIT_KEYS) {
    const grant = value[key]
    if (grant === null || (grant !== undefined && grant > GRANT_LIMIT_MAX)) {
      ctx.addIssue({ code: "custom", path: [key], message: "cp.limit_grant_unlimited" })
    }
  }
})

/**
 * A package's platform flags (Ek C9): keys of the shared list only, on or
 * off; null takes the package's value away (the list's default applies).
 */
const features = z.record(z.string(), z.boolean().nullable()).superRefine((value, ctx) => {
  for (const key of Object.keys(value)) {
    if (!isPlatformFlag(key, process.env["NODE_ENV"])) {
      ctx.addIssue({ code: "custom", path: [key], message: "cp.flag_unknown" })
    }
  }
})

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
    features: features.optional(),
  })
  .strict()
export type PostPlanType = z.infer<typeof PostPlan>

/**
 * A package's name, limits and flags; its price and its trial and grace
 * days apart (`/price`, `/terms`: a step-up, adr/0061 §3.5, Ek C19 L1).
 */
export const PostPlanUpdate = z
  .object({
    name: name.optional(),
    limits: limits.optional(),
    features: features.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "cp.nothing_to_save")
export type PostPlanUpdateType = z.infer<typeof PostPlanUpdate>

/** A package's price and period: from the next period on (adr/0061 §7). */
export const PostPlanPrice = z.object({ price, period: z.enum(BILLING_PERIODS) }).strict()
export type PostPlanPriceType = z.infer<typeof PostPlanPrice>

/** A package's trial and grace days (Ek C19 L1: a step-up, as one shop's grace days). */
export const PostPlanTerms = z
  .object({ trial_days: days(365).optional(), grace_days: days(90).optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "cp.nothing_to_save")
export type PostPlanTermsType = z.infer<typeof PostPlanTerms>
