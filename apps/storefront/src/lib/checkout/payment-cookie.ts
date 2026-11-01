import "server-only"
import { cookies } from "next/headers"
import { paymentFrameOrigins, storefrontEnv } from "../env"

/**
 * The card form's address between "pay" and the page that frames it
 * (D7): an httpOnly cookie for the checkout's paths, half an hour (the
 * provider's own limit). Only an allowed origin's address is kept, so
 * the frame page can never be made to frame anything else.
 */
const NAME = "qt_pay"
const MAX_AGE = 30 * 60

export function allowedFrameUrl(value: string): string | null {
  const url = URL.parse(value)
  if (!url) {
    return null
  }
  return paymentFrameOrigins(storefrontEnv()).includes(url.origin) ? url.href : null
}

export async function rememberPaymentFrame(url: string): Promise<boolean> {
  const allowed = allowedFrameUrl(url)
  if (!allowed) {
    return false
  }
  ;(await cookies()).set(NAME, allowed, {
    httpOnly: true,
    secure: storefrontEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/odeme",
    maxAge: MAX_AGE,
  })
  return true
}

export async function paymentFrame(): Promise<string | null> {
  const value = (await cookies()).get(NAME)?.value
  return value ? allowedFrameUrl(value) : null
}

export async function forgetPaymentFrame(): Promise<void> {
  ;(await cookies()).delete({ name: NAME, path: "/odeme" })
}
