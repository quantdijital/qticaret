import "server-only"
import { cookies } from "next/headers"
import { paymentFrameOrigins, storefrontEnv } from "../env"
import { clearOwnCookie, cookieName, setOwnCookie } from "../security/cookies"

/**
 * The card form's address between "pay" and the page that frames it
 * (D7): an httpOnly cookie (`__Host-` over HTTPS), half an hour (the
 * provider's own limit), bound to the cart it was started for. Only an
 * allowed origin's address is kept and read, and only for the cart the
 * browser holds now, so the frame page frames nothing else and no one
 * else's payment.
 */
const NAME = () => cookieName("qt_pay")
const MAX_AGE = 30 * 60
const CART = /^cart_[0-9A-Za-z]{10,64}$/

export function allowedFrameUrl(value: string): string | null {
  const url = URL.parse(value)
  if (!url) {
    return null
  }
  return paymentFrameOrigins(storefrontEnv()).includes(url.origin) ? url.href : null
}

export async function rememberPaymentFrame(cartId: string, url: string): Promise<boolean> {
  const allowed = allowedFrameUrl(url)
  if (!allowed || !CART.test(cartId)) {
    return false
  }
  await setOwnCookie(NAME(), `${cartId}|${allowed}`, MAX_AGE)
  return true
}

/** The card form's address for this cart; null for none, another cart's, or a disallowed one. */
export async function paymentFrame(cartId: string): Promise<string | null> {
  const value = (await cookies()).get(NAME())?.value
  const at = value?.indexOf("|") ?? -1
  if (!value || at < 0 || value.slice(0, at) !== cartId) {
    return null
  }
  return allowedFrameUrl(value.slice(at + 1))
}

export async function forgetPaymentFrame(): Promise<void> {
  await clearOwnCookie(NAME())
}
