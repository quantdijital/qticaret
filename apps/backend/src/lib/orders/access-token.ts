import { createHmac } from "node:crypto"
import { parseKey, safeEqual } from "@qticaret/server-kit"
import { parseEnv } from "../env"

/**
 * The key to a guest's order (adr/0037 §2): an HMAC binding the order, its
 * e-mail and an end date, so a link in the order's e-mail opens that order
 * only, for a while, and an order id alone opens nothing. Keyed with
 * `PII_HASH_KEY` under its own context; nothing is stored.
 */

export const ORDER_ACCESS_DAYS = 30

/** The storefront's order page (F18 builds it): `/siparis/<id>?token=<key>`. */
export const ORDER_PATH = "/siparis"

/** The instance's key for order links. */
export const orderAccessKey = (): Buffer => parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
const DAY_MS = 24 * 60 * 60 * 1000

const macOf = (key: Buffer, orderId: string, email: string, expires: string): string =>
  createHmac("sha256", key)
    .update(`order-access:v1:${orderId}:${email.trim().toLowerCase()}:${expires}`, "utf8")
    .digest("base64url")

/** `<end, base 36 seconds>.<mac>`: opens the order until the end. */
export function orderAccessToken(
  key: Buffer,
  order: { id: string; email: string },
  now = new Date()
): string {
  const expires = Math.floor((now.getTime() + ORDER_ACCESS_DAYS * DAY_MS) / 1000).toString(36)
  return `${expires}.${macOf(key, order.id, order.email, expires)}`
}

/** Whether the token opens this order now: its own, unchanged, not past its end. */
export function opensOrder(
  key: Buffer,
  token: string,
  order: { id: string; email: string | null },
  now = new Date()
): boolean {
  const match = /^([0-9a-z]{1,12})\.([\w-]{43})$/.exec(token)
  if (!match?.[1] || !match[2] || !order.email) {
    return false
  }
  if (parseInt(match[1], 36) * 1000 <= now.getTime()) {
    return false
  }
  return safeEqual(match[2], macOf(key, order.id, order.email, match[1]))
}
