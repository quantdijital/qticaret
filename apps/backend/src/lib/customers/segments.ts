import { z } from "@medusajs/framework/zod"

/**
 * A segment's rules (F10.3, adr/0037 §6): who belongs to it, from what the
 * shop knows of each customer. Every rule given must hold; none given is
 * no segment. Sector-neutral: spending, orders, recency, an account and
 * campaign consent; money in kuruş.
 */
export const segmentRules = z
  .object({
    /** Spent at least this much over all their orders, in kuruş. */
    min_total_spent: z.number().int().positive().max(1_000_000_000_00).optional(),
    min_orders: z.number().int().positive().max(100_000).optional(),
    /** Ordered within the last this many days. */
    ordered_within_days: z.number().int().positive().max(3650).optional(),
    /** Has not ordered for this many days, but has ordered before (won back). */
    not_ordered_for_days: z.number().int().positive().max(3650).optional(),
    /** Has an account (true) or shopped as a guest only (false). */
    registered: z.boolean().optional(),
    /** Takes campaign e-mail. */
    email_consent: z.boolean().optional(),
  })
  .strict()
  .refine((rules) => Object.values(rules).some((value) => value !== undefined), {
    message: "customer_segments.rules_empty",
  })

export type SegmentRules = z.infer<typeof segmentRules>

/** What the shop knows of one customer, for the rules. */
export interface CustomerFacts {
  id: string
  hasAccount: boolean
  /** Kuruş over their orders. */
  spent: number
  orders: number
  lastOrderAt: Date | null
  emailConsent: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whether the customer belongs: every rule given holds. */
export function inSegment(rules: SegmentRules, facts: CustomerFacts, now = new Date()): boolean {
  const since = facts.lastOrderAt ? (now.getTime() - facts.lastOrderAt.getTime()) / DAY_MS : null
  return (
    (rules.min_total_spent === undefined || facts.spent >= rules.min_total_spent) &&
    (rules.min_orders === undefined || facts.orders >= rules.min_orders) &&
    (rules.ordered_within_days === undefined ||
      (since !== null && since <= rules.ordered_within_days)) &&
    (rules.not_ordered_for_days === undefined ||
      (since !== null && since > rules.not_ordered_for_days)) &&
    (rules.registered === undefined || facts.hasAccount === rules.registered) &&
    (rules.email_consent === undefined || facts.emailConsent === rules.email_consent)
  )
}

/** Whether the rules need the customers' orders read at all. */
export const needsOrders = (rules: SegmentRules): boolean =>
  rules.min_total_spent !== undefined ||
  rules.min_orders !== undefined ||
  rules.ordered_within_days !== undefined ||
  rules.not_ordered_for_days !== undefined
