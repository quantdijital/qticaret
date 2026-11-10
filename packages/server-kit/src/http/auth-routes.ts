/**
 * What a Medusa `/auth/*` request is, from its route path (`routePathOf`):
 * each app counts the kinds against its own rate limit profiles (docs/04).
 */

export type AuthRouteKind =
  "token_refresh" | "session" | "register" | "password_reset" | "auth_default" | "login"

const AUTH_ROUTES: readonly [RegExp, AuthRouteKind][] = [
  [/^\/auth\/token\/refresh$/, "token_refresh"],
  [/^\/auth\/session$/, "session"],
  [/^\/auth\/[^/]+\/[^/]+\/register$/, "register"],
  [/^\/auth\/[^/]+\/[^/]+\/reset-password$/, "password_reset"],
  [/^\/auth\/[^/]+\/[^/]+\/(update|callback)$/, "auth_default"],
  [/^\/auth\/[^/]+\/[^/]+$/, "login"],
]

/**
 * The kind of an /auth/* route. Any other path is a login, the strictest:
 * a path these patterns miss must not miss the login limit with them.
 */
export function authRouteKind(path: string): AuthRouteKind {
  return AUTH_ROUTES.find(([pattern]) => pattern.test(path))?.[1] ?? "login"
}

/**
 * The body field naming the account a request targets: emailpass login and
 * registration read `email`, a reset reads `identifier`, a verification
 * request `entity_id`. Counting another field would let a decoy value keep
 * the real target's count at zero.
 */
export function authIdentityField(path: string): "email" | "identifier" | "entity_id" {
  if (authRouteKind(path) === "password_reset") {
    return "identifier"
  }
  return path === "/auth/verification/request" ? "entity_id" : "email"
}
