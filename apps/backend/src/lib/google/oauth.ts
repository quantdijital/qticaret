import { createHash, randomBytes } from "node:crypto"
import { parseEnv } from "../env"
import type { Env } from "../env"

/**
 * The shop's Google account (F10 M13, adr/0038 §5), connected with the
 * platform's own OAuth client: Google's web server flow with `state` and
 * PKCE (S256), offline access for a refresh token. Checked against
 * Google's OAuth 2.0 documentation.
 */

export const GOOGLE_PROVIDER = "google"

/** Where Google sends the shop back: the backend, reached through the panel's origin (adr/0022 §4). */
export const GOOGLE_CALLBACK_PATH = "/google/callback"

/**
 * Merchant Center's API; Search Console's, whole (submitting a sitemap
 * needs more than read-only, F10.11); and the account's address, to show
 * which one is connected.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/content",
  "https://www.googleapis.com/auth/webmasters",
  "openid",
  "email",
] as const

/** Search Console's scope: a connection made before F10.11 lacks it and is made again. */
export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters"

/**
 * The panel page Google's callback returns to (adr/0022 §4): a path, never
 * an address, so the browser stays on the origin the callback came in on
 * (the panel's) and no redirect leaves it.
 */
export const GOOGLE_PANEL_PATH = "/settings/marketing"

export interface GoogleClient {
  clientId: string
  clientSecret: string
}

/** The platform's OAuth client; null until both of its values are set. */
export function googleClientOf(env: Env = parseEnv()): GoogleClient | null {
  return env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET
    ? { clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET }
    : null
}

/** Google's hosts; a fake server's for all of them in tests (`GOOGLE_BASE_URL`). */
export function googleHosts(env: Env = parseEnv()) {
  const fake = env.GOOGLE_BASE_URL?.replace(/\/+$/, "")
  return {
    accounts: fake ?? "https://accounts.google.com",
    oauth: fake ?? "https://oauth2.googleapis.com",
    merchant: fake ?? "https://merchantapi.googleapis.com",
    webmasters: fake ?? "https://www.googleapis.com",
    searchConsole: fake ?? "https://searchconsole.googleapis.com",
    crux: fake ?? "https://chromeuxreport.googleapis.com",
  }
}

/** A PKCE verifier (kept on the server) and its S256 challenge (sent to Google). */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url")
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") }
}

/**
 * The address the shop is sent to, to let the platform's client reach its
 * Merchant Center: offline access and the consent screen every time, so
 * Google hands over a refresh token again; with `include_granted_scopes`
 * the new token keeps what the shop allowed before.
 */
export function authorizationUrl(
  client: GoogleClient,
  input: { state: string; challenge: string; redirectUri: string },
  accountsHost: string = googleHosts().accounts
): string {
  const query = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  })
  return `${accountsHost}/o/oauth2/v2/auth?${query.toString()}`
}

/**
 * The address in an ID token Google's token endpoint handed over itself,
 * over TLS: read, not verified again, to show which account is connected.
 */
export function emailOfIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1]
  if (!payload) {
    return null
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown
    }
    return typeof claims.email === "string" && claims.email.length <= 254 ? claims.email : null
  } catch {
    return null
  }
}
