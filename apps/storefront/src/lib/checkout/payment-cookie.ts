import "server-only"
import { cookies } from "next/headers"
import { paymentFrameOrigins, storefrontEnv } from "../env"
import { clearOwnCookie, cookieName, setOwnCookie } from "../security/cookies"

/**
 * The card form's address between "pay" and the page that frames it
 * (D7): an httpOnly cookie (`__Host-` over HTTPS), half an hour (the
 * provider's own limit), bound to the cart it was started for and to the
 * payment session the form charges. Only an allowed origin's address is
 * kept and read, and only for the cart the browser holds now, so the
 * frame page frames nothing else and no one else's payment; that page
 * also checks the session is still the cart's, for the cart's total now
 * (`sessionCurrent`), before it frames the form.
 */
const NAME = () => cookieName("qt_pay")
const MAX_AGE = 30 * 60
const CART = /^cart_[0-9A-Za-z]{10,64}$/
const SESSION = /^payses_[0-9A-Za-z]{10,64}$/

export interface PaymentFrame {
  url: string
  /** The payment session the form was made for. */
  session: string
}

export function allowedFrameUrl(value: string): string | null {
  const url = URL.parse(value)
  if (!url) {
    return null
  }
  return paymentFrameOrigins(storefrontEnv()).includes(url.origin) ? url.href : null
}

export async function rememberPaymentFrame(
  cartId: string,
  sessionId: string,
  url: string
): Promise<boolean> {
  const allowed = allowedFrameUrl(url)
  if (!allowed || !CART.test(cartId) || !SESSION.test(sessionId)) {
    return false
  }
  await setOwnCookie(NAME(), `${cartId}|${sessionId}|${allowed}`, MAX_AGE)
  return true
}

/** The card form for this cart; null for none, another cart's, or a disallowed one. */
export async function paymentFrame(cartId: string): Promise<PaymentFrame | null> {
  const [cart, session, ...rest] = ((await cookies()).get(NAME())?.value ?? "").split("|")
  if (cart !== cartId || !session || !SESSION.test(session)) {
    return null
  }
  const url = allowedFrameUrl(rest.join("|"))
  return url ? { url, session } : null
}

export async function forgetPaymentFrame(): Promise<void> {
  await clearOwnCookie(NAME())
}
