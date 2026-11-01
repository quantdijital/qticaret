import "server-only"
import { cookies } from "next/headers"
import { storefrontEnv } from "../env"

const MAX_AGE = 30 * 24 * 60 * 60

/**
 * The cart's id lives in an httpOnly cookie on the storefront's own domain
 * (adr/0046 §6): `__Host-` once served over HTTPS (no subdomain can set or
 * read it), a plain name on a developer's http://localhost.
 */
const cookieName = () => (storefrontEnv().NODE_ENV === "production" ? "__Host-qt_cart" : "qt_cart")

const CART_ID = /^cart_[0-9A-Za-z]{10,64}$/

export async function cartIdFromCookie(): Promise<string | null> {
  const value = (await cookies()).get(cookieName())?.value ?? null
  return value !== null && CART_ID.test(value) ? value : null
}

export async function rememberCart(cartId: string): Promise<void> {
  const production = storefrontEnv().NODE_ENV === "production"
  ;(await cookies()).set(cookieName(), cartId, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  })
}

export async function forgetCart(): Promise<void> {
  ;(await cookies()).delete(cookieName())
}
