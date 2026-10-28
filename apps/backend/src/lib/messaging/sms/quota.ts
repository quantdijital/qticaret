import type { RateLimitStore } from "../../security/rate-limit"

/**
 * SMS quotas (F9.8, docs/04 SMS pumping): every text costs the shop, and
 * a form that sends one (a code, a stock notice) can be abused to send
 * thousands. Counted per number (by its keyed hash, never the number), per
 * shop per day, and per visitor's IP where a visitor asks for the text.
 */

export const SMS_LIMITS = {
  perNumberHour: 5,
  perNumberDay: 10,
  /** A visitor's requests an hour before a challenge (captcha) is asked, and before refusal. */
  perIpChallenge: 3,
  perIpHour: 10,
  /** The share of the shop's daily limit that warns staff of the cost. */
  warnShare: 0.8,
} as const

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * The cart's mark that its order's texts are held (F10 M9): checkout
 * sends "order received" to any phone typed in, so one address
 * completing more carts in an hour than `perIpHour` gets no texts for
 * them; the e-mail still goes. Under `qt_`: a storefront cannot set it.
 */
export const CHECKOUT_SMS_HELD = "qt_sms_held"

/** Counts a cart completed from the visitor's address; false once it is past the hour's limit. */
export async function checkoutSmsAllowed(
  store: RateLimitStore,
  ipBucket: string,
  scale = 1
): Promise<boolean> {
  const visits = await store.hit(`sms:checkout:${ipBucket}`, HOUR)
  return visits.count <= SMS_LIMITS.perIpHour * scale
}

export interface SmsAllowance {
  allowed: boolean
  /** Which limit refused it. */
  reason: "number" | "shop" | "ip" | null
  /** A visitor asked too often: ask a challenge before sending (F15 picks the provider). */
  challenge: boolean
  /** This text is the one that reached the warning share of the day's limit. */
  warn: boolean
  /** Texts the shop sent today, this one counted. */
  shopToday: number
}

/**
 * Counts one text against every limit that applies and says whether it
 * may go. `ipBucket` only where a visitor's request sends it.
 */
export async function smsAllowance(
  store: RateLimitStore,
  input: { numberKey: string; dailyLimit: number; ipBucket?: string; now?: Date }
): Promise<SmsAllowance> {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10)
  let challenge = false
  if (input.ipBucket) {
    const ip = await store.hit(`sms:ip:${input.ipBucket}`, HOUR)
    if (ip.count > SMS_LIMITS.perIpHour) {
      return { allowed: false, reason: "ip", challenge: true, warn: false, shopToday: 0 }
    }
    challenge = ip.count > SMS_LIMITS.perIpChallenge
  }
  const [hour, today] = await Promise.all([
    store.hit(`sms:number:h:${input.numberKey}`, HOUR),
    store.hit(`sms:number:d:${input.numberKey}`, DAY),
  ])
  if (hour.count > SMS_LIMITS.perNumberHour || today.count > SMS_LIMITS.perNumberDay) {
    return { allowed: false, reason: "number", challenge, warn: false, shopToday: 0 }
  }
  const shop = await store.hit(`sms:shop:${day}`, DAY)
  if (shop.count > input.dailyLimit) {
    return { allowed: false, reason: "shop", challenge, warn: false, shopToday: shop.count }
  }
  return {
    allowed: true,
    reason: null,
    challenge,
    warn: shop.count === Math.ceil(input.dailyLimit * SMS_LIMITS.warnShare),
    shopToday: shop.count,
  }
}
