import "server-only"
import { cookies } from "next/headers"
import { storefrontEnv } from "../env"

/**
 * Our own cookies' common attributes (D7, D8): httpOnly, SameSite=Lax,
 * Path=/, and over HTTPS Secure with the `__Host-` prefix (no subdomain can
 * set or read them). A cookie is cleared with the very same attributes:
 * a browser ignores a `__Host-` cookie's deletion that is not Secure, so
 * Next's plain `delete` would leave it in place.
 */
export const isProduction = () => storefrontEnv().NODE_ENV === "production"

export const cookieName = (base: string) => (isProduction() ? `__Host-${base}` : base)

export async function setOwnCookie(name: string, value: string, maxAge: number): Promise<void> {
  ;(await cookies()).set(name, value, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge,
  })
}

export async function clearOwnCookie(name: string): Promise<void> {
  ;(await cookies()).set(name, "", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
