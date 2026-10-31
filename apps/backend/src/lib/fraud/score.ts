/**
 * A placed order's suspicion score (F15.6, adr/0044 §3): each rule that
 * holds adds its points; at the shop's threshold the order waits for a
 * person. The reasons are rule names and points, never the data.
 */

export interface OrderFacts {
  /** The buyer's first order here. */
  firstOrder: boolean
  /** In kuruş, as the shop's threshold. */
  total: number
  highAmount: number
  shippingProvince: string | null
  billingProvince: string | null
  /** Distinct e-mails the buyer's address used for checkouts today. */
  ipEmails: number
  /** Distinct e-mails the delivery phone was used with this week. */
  phoneEmails: number
  disposableEmail: boolean
  /** Payment attempts on the cart that failed before this one. */
  failedPayments: number
}

export const SCORE_RULES = {
  new_customer_high_amount: 30,
  address_mismatch: 10,
  ip_many_emails: 20,
  phone_many_emails: 25,
  disposable_email: 20,
  failed_payments: 20,
} as const

export type ScoreRule = keyof typeof SCORE_RULES

export interface Score {
  score: number
  reasons: { rule: ScoreRule; points: number }[]
}

const sameProvince = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr")

export function scoreOrder(facts: OrderFacts): Score {
  const holds: Record<ScoreRule, boolean> = {
    new_customer_high_amount: facts.firstOrder && facts.total >= facts.highAmount,
    address_mismatch:
      !!facts.shippingProvince &&
      !!facts.billingProvince &&
      !sameProvince(facts.shippingProvince, facts.billingProvince),
    // A mobile carrier's address is shared: only many e-mails count
    ip_many_emails: facts.ipEmails >= 5,
    phone_many_emails: facts.phoneEmails >= 3,
    disposable_email: facts.disposableEmail,
    failed_payments: facts.failedPayments >= 3,
  }
  const reasons = (Object.keys(SCORE_RULES) as ScoreRule[])
    .filter((rule) => holds[rule])
    .map((rule) => ({ rule, points: SCORE_RULES[rule] }))
  return { score: reasons.reduce((sum, reason) => sum + reason.points, 0), reasons }
}
