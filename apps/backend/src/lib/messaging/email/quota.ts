import type { RateLimitStore } from "../../security/rate-limit"

/**
 * The shop's e-mails a day (F10 M9): a guard on the sender's reputation.
 * Orders and forms with made-up addresses bounce, and enough bounces get
 * a sender blocked; past the limit nothing goes until the next day.
 */

/** The share of the day's limit that warns staff. */
export const EMAIL_WARN_SHARE = 0.8

const DAY = 24 * 60 * 60 * 1000

export interface EmailAllowance {
  allowed: boolean
  /** This e-mail is the one that reached the warning share of the day's limit. */
  warn: boolean
  /** E-mails the shop sent today, this one counted. */
  shopToday: number
}

/** Counts one e-mail against the shop's day and says whether it may go. */
export async function emailAllowance(
  store: RateLimitStore,
  input: { dailyLimit: number; now?: Date }
): Promise<EmailAllowance> {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10)
  const shop = await store.hit(`email:shop:${day}`, DAY)
  return {
    allowed: shop.count <= input.dailyLimit,
    warn: shop.count === Math.ceil(input.dailyLimit * EMAIL_WARN_SHARE),
    shopToday: shop.count,
  }
}
