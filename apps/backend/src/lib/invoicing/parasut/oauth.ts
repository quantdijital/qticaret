import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions } from "../../clients"
import { parseEnv } from "../../env"
import type { Env } from "../../env"

/**
 * Paraşüt's OAuth2 (API v4, apidocs.parasut.com swagger.json; adr/0034
 * §5). The platform has one client; a shop allows it on Paraşüt's page and
 * pastes the code it is shown (the out-of-band redirect), so the shop's
 * Paraşüt password never reaches us. An access token lasts two hours;
 * every refresh hands out a new refresh token and the old one dies.
 */

export const PARASUT_PROVIDER = "parasut"

/** Paraşüt's redirect for a client with none of its own: the code is shown to be copied. */
export const PARASUT_OOB_REDIRECT = "urn:ietf:wg:oauth:2.0:oob"

export interface ParasutClient {
  clientId: string
  clientSecret: string
}

export interface ParasutTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/** Paraşüt's host; a fake one's in development and tests (`PARASUT_BASE_URL`). */
export const parasutOrigin = (env: Pick<Env, "PARASUT_BASE_URL"> = parseEnv()): string =>
  (env.PARASUT_BASE_URL ?? "https://api.parasut.com").replace(/\/+$/, "")

/** The platform's client; null until both of its values are set. */
export function parasutClientOf(env: Env = parseEnv()): ParasutClient | null {
  return env.PARASUT_CLIENT_ID && env.PARASUT_CLIENT_SECRET
    ? { clientId: env.PARASUT_CLIENT_ID, clientSecret: env.PARASUT_CLIENT_SECRET }
    : null
}

/** Where the shop allows the platform and is shown the code to paste. */
export function parasutAuthorizeUrl(client: ParasutClient, origin: string = parasutOrigin()) {
  const url = new URL("/oauth/authorize", origin)
  url.searchParams.set("client_id", client.clientId)
  url.searchParams.set("redirect_uri", PARASUT_OOB_REDIRECT)
  url.searchParams.set("response_type", "code")
  return url.toString()
}

const TokenAnswer = z.looseObject({
  access_token: z.string().min(1).max(2000),
  refresh_token: z.string().min(1).max(2000),
  expires_in: z.number().int().positive(),
})

const oauthError = (body: unknown): string | undefined => {
  const error = (body as { error?: unknown } | null)?.error
  return typeof error === "string" ? error : undefined
}

// A token taken a minute early: one that dies on the way is never sent
const EARLY_MS = 60_000

export function createParasutOauth(
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & { origin?: string } = {}
) {
  const http = createHttpClient({
    ...options,
    baseUrl: options.origin ?? parasutOrigin(),
    provider: PARASUT_PROVIDER,
    errorCode: oauthError,
  })
  const now = options.now ?? Date.now

  async function grant(
    client: ParasutClient,
    fields: Record<string, string>,
    repeatable: boolean
  ): Promise<ParasutTokens> {
    const answer = await http.request({
      method: "POST",
      path: "/oauth/token",
      form: { ...fields, client_id: client.clientId, client_secret: client.clientSecret },
      // A code or a refresh token works once: sent again, it would be refused
      idempotent: repeatable,
      logPath: "/oauth/token",
      schema: TokenAnswer,
    })
    return {
      accessToken: answer.access_token,
      refreshToken: answer.refresh_token,
      expiresAt: new Date(now() + answer.expires_in * 1000 - EARLY_MS),
    }
  }

  return {
    /** Trades the code the shop pasted; a code works once. */
    exchangeCode: (client: ParasutClient, code: string) =>
      grant(
        client,
        { grant_type: "authorization_code", code, redirect_uri: PARASUT_OOB_REDIRECT },
        false
      ),
    /** A new pair from the last refresh token; the one sent dies. */
    refresh: (client: ParasutClient, refreshToken: string) =>
      grant(client, { grant_type: "refresh_token", refresh_token: refreshToken }, false),
  }
}
