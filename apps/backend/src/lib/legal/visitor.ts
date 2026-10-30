import { randomBytes } from "node:crypto"
import { isLocalEnv, parseEnv } from "../env"

/**
 * The storefront's own visitor cookie (F13.8, adr/0041 §5): a random id
 * that ties a visitor's cookie banner answers together before they have a
 * cart. Only the server reads it (HttpOnly); the database keeps its keyed
 * hash, never the id.
 */
export const VISITOR_COOKIE = "qt_vid"

// Over HTTPS the cookie takes the `__Host-` prefix: the browser then refuses
// one set by another subdomain (no Domain, Path=/, Secure), so no visitor
// can be handed an id chosen for them
const HOST_COOKIE = `__Host-${VISITOR_COOKIE}`

/** Thirteen months, the longest a cookie consent is asked to last. */
export const VISITOR_MAX_AGE_SECONDS = 396 * 24 * 60 * 60

const VISITOR_ID = /^[A-Za-z0-9_-]{32}$/

/** The visitor's id from a `Cookie` header (the `__Host-` one over HTTPS); null without one, or with one not ours. */
export function visitorIdOf(cookieHeader: string | undefined, secure = false): string | null {
  const wanted = secure ? HOST_COOKIE : VISITOR_COOKIE
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=")
    if (name === wanted) {
      const id = value.join("=")
      return VISITOR_ID.test(id) ? id : null
    }
  }
  return null
}

/** Secure cookies everywhere but on a developer's machine, as the session cookie is set. */
export const secureCookies = (): boolean => !isLocalEnv(parseEnv())

/** A new visitor id: 24 random bytes, 32 characters. */
export const newVisitorId = (): string => randomBytes(24).toString("base64url")

/** The `Set-Cookie` value that keeps the id for another thirteen months. */
export function visitorCookie(id: string, secure: boolean): string {
  return [
    `${secure ? HOST_COOKIE : VISITOR_COOKIE}=${id}`,
    "Path=/",
    `Max-Age=${String(VISITOR_MAX_AGE_SECONDS)}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ")
}

/**
 * What a measurement consent may allow, held to the visitor's cookie
 * banner answer: never more than it allows; what the storefront sends
 * may only narrow it.
 */
export function heldToCookieConsent(
  sent: { analytics?: boolean | undefined; marketing?: boolean | undefined },
  answer: { analytics: boolean; marketing: boolean }
): { analytics: boolean; marketing: boolean } {
  return {
    analytics: answer.analytics && (sent.analytics ?? true),
    marketing: answer.marketing && (sent.marketing ?? true),
  }
}
