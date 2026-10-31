import type { RateLimitStore } from "../../security/rate-limit"

/**
 * The shop's e-mails a day (F10 M9): a guard on the sender's reputation.
 * Orders and forms with made-up addresses bounce, and enough bounces get
 * a sender blocked; past the limit nothing goes until the next day.
 * Commercial e-mails and the rest (orders, resets) are counted apart,
 * each to the limit: a campaign never stops an order's e-mail (the
 * owner, 2026-10-30).
 */

/** The share of the day's limit that warns staff. */
export const EMAIL_WARN_SHARE = 0.8

/**
 * The share of the day's limit e-mails anyone can make the shop send take
 * at most: a verification code, a password reset, an order's link, a
 * stock alert's confirmation, a cart's reminder. However many someone
 * asks for, the rest of the day stays for orders (security review
 * 2026-10-29).
 */
export const EMAIL_OPEN_SHARE = 0.25

/** Templates anyone can make the shop send, without an order or staff behind them. */
export const OPEN_TEMPLATES: readonly string[] = [
  "account.verify_email",
  "account.password_reset",
  "staff.password_reset",
  "order.access_link",
  "stock.alert_confirm",
  "cart.reminder",
  "consent.confirm",
]

const DAY = 24 * 60 * 60 * 1000

export interface EmailAllowance {
  allowed: boolean
  /** Why not: the shop's day, or the open e-mails' share of it. */
  reason?: "shop" | "open"
  /** This e-mail is the one that reached the warning share of the day's limit. */
  warn: boolean
  /** E-mails of its kind the shop sent today, this one counted. */
  shopToday: number
}

/** An e-mail's budget: a commercial one, or one about an order, an account, a form. */
export type EmailBudget = "commercial" | "transactional"

/**
 * Counts one e-mail against its budget's day and says whether it may go.
 * An open one is counted against its share of the transactional day
 * first; past it, it does not count against the day.
 */
export async function emailAllowance(
  store: RateLimitStore,
  input: { dailyLimit: number; budget?: EmailBudget; open?: boolean; now?: Date }
): Promise<EmailAllowance> {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10)
  const budget = input.budget ?? "transactional"
  if (input.open) {
    const opened = await store.hit(`email:open:${day}`, DAY)
    if (opened.count > Math.ceil(input.dailyLimit * EMAIL_OPEN_SHARE)) {
      return { allowed: false, reason: "open", warn: false, shopToday: 0 }
    }
  }
  // The transactional day keeps its old key: a day's count survives the release
  const shop = await store.hit(
    budget === "commercial" ? `email:commercial:${day}` : `email:shop:${day}`,
    DAY
  )
  return {
    ...(shop.count <= input.dailyLimit ? {} : { reason: "shop" as const }),
    allowed: shop.count <= input.dailyLimit,
    warn: shop.count === Math.ceil(input.dailyLimit * EMAIL_WARN_SHARE),
    shopToday: shop.count,
  }
}
