import "server-only"
import { cookies } from "next/headers"
import { storefrontEnv } from "../env"

/**
 * The signed-in customer's key (D8, adr/0004): the backend's bearer token,
 * kept by the storefront's server in an httpOnly cookie on its own domain
 * (`__Host-` over HTTPS). The browser never sees or sends it to the
 * backend; the storefront adds it to its own Store API calls. A day long,
 * as the token. A second cookie holds, for a quarter of an hour, the key
 * of an account still to verify its e-mail: the code confirms only with
 * the identity that asked for it.
 */
const production = () => storefrontEnv().NODE_ENV === "production"
const SESSION = () => (production() ? "__Host-qt_session" : "qt_session")
const PENDING = () => (production() ? "__Host-qt_verify" : "qt_verify")

const DAY = 24 * 60 * 60
const QUARTER = 15 * 60

// A JWT: three base64url parts
const TOKEN = /^[\w-]+\.[\w-]+\.[\w-]+$/

async function read(name: string): Promise<string | null> {
  const value = (await cookies()).get(name)?.value ?? null
  return value !== null && value.length < 4096 && TOKEN.test(value) ? value : null
}

async function write(name: string, token: string, maxAge: number): Promise<void> {
  ;(await cookies()).set(name, token, {
    httpOnly: true,
    secure: production(),
    sameSite: "lax",
    path: "/",
    maxAge,
  })
}

export const sessionToken = () => read(SESSION())
export const startSession = (token: string) => write(SESSION(), token, DAY)
export async function endSession(): Promise<void> {
  ;(await cookies()).delete(SESSION())
}

export const pendingToken = () => read(PENDING())
export const rememberPending = (token: string) => write(PENDING(), token, QUARTER)
export async function forgetPending(): Promise<void> {
  ;(await cookies()).delete(PENDING())
}

/** The token's claims, unverified: only to tell an account-less token (actor not yet set). */
export function claimsOf(token: string): { actor_id?: string; exp?: number } {
  try {
    const part = token.split(".")[1] ?? ""
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      actor_id?: string
      exp?: number
    }
  } catch {
    return {}
  }
}
