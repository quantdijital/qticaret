import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions } from "../../clients"
import { parseEnv } from "../../env"
import type { Env } from "../../env"
import { ProviderError } from "../../errors"

/**
 * Shopify's GraphQL Admin API, read once to move a shop here (F14,
 * adr/0042; shopify.dev/docs/api/admin-graphql). The owner's app from the
 * Dev Dashboard buys a token for a day with its client id and secret
 * (client credentials grant; the app and the store in one organization).
 * Calls are costed: a throttled one waits and goes again. Only reads.
 */

export const SHOPIFY_PROVIDER = "shopify"
/** A stable version, supported a year from its release (shopify.dev/docs/api/usage/versioning). */
export const SHOPIFY_API_VERSION = "2026-10"

export interface ShopifyCredentials {
  shopDomain: string
  clientId: string
  clientSecret: string
}

// Shopify's own host for a store, checked again at every read: requests go to it
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/

/** The shop's account as `integration-credentials` keeps it; null when a part is missing or bent. */
export function shopifyCredentialsOf(account: {
  settings: Record<string, unknown>
  secrets: Record<string, string>
}): ShopifyCredentials | null {
  const { shop_domain: shopDomain, client_id: clientId } = account.settings
  const clientSecret = account.secrets["client_secret"]
  return typeof shopDomain === "string" &&
    SHOP_DOMAIN.test(shopDomain) &&
    typeof clientId === "string" &&
    clientSecret
    ? { shopDomain, clientId, clientSecret }
    : null
}

/** The store's own origin; a fake Shopify's in development and tests (`SHOPIFY_BASE_URL`). */
export const shopifyOrigin = (
  shopDomain: string,
  env: Pick<Env, "SHOPIFY_BASE_URL"> = parseEnv()
): string => (env.SHOPIFY_BASE_URL ?? `https://${shopDomain}`).replace(/\/+$/, "")

const Token = z.object({
  access_token: z.string().min(1).max(1024),
  scope: z.string().max(2048).default(""),
  expires_in: z.number().int().positive(),
})

const GraphqlError = z.looseObject({
  message: z.string().max(2000).default(""),
  extensions: z.looseObject({ code: z.string().max(100).optional() }).optional(),
})

const Answer = z.looseObject({
  data: z.unknown().optional(),
  errors: z.union([z.array(GraphqlError), z.string()]).optional(),
})

/** Shopify's word for a refusal: an OAuth error, or the GraphQL error's code. */
function errorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined
  }
  const { error } = body as { error?: unknown }
  if (typeof error === "string" && /^[a-z_]{1,64}$/.test(error)) {
    return `oauth_${error}`
  }
  return undefined
}

// A throttled call waits a second and goes again (shopify.dev: "the recommended backoff")
const THROTTLE_WAIT_MS = 1_000
const MAX_THROTTLED = 30
// A day's token is bought again this long before Shopify lets it go
const REFRESH_BEFORE_MS = 60_000

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export type ShopifyErrorCode =
  "oauth_shop_not_permitted" | "oauth_invalid_client" | "access_denied" | "graphql_error"

export function createShopifyApi(
  credentials: ShopifyCredentials,
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & { origin?: string } = {}
) {
  const http = createHttpClient({
    timeoutMs: 30_000,
    ...options,
    baseUrl: options.origin ?? shopifyOrigin(credentials.shopDomain),
    provider: SHOPIFY_PROVIDER,
    errorCode,
  })
  const sleep = options.sleep ?? wait
  const now = options.now ?? Date.now
  let held: { token: string; until: number } | null = null

  async function token(signal?: AbortSignal): Promise<string> {
    if (held && held.until - REFRESH_BEFORE_MS > now()) {
      return held.token
    }
    const answer = await http.request({
      method: "POST",
      path: ["admin", "oauth", "access_token"],
      form: {
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      },
      // Asking for a token changes nothing at Shopify: safe to ask again
      idempotent: true,
      logPath: "/admin/oauth/access_token",
      ...(signal ? { signal } : {}),
      schema: Token,
    })
    held = { token: answer.access_token, until: now() + answer.expires_in * 1000 }
    return held.token
  }

  /**
   * One GraphQL call; `read` marks one that changes nothing, safe to send
   * again. A throttled call waits its turn; any other error is refused.
   */
  async function graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    schema: z.ZodType<T>,
    { read, signal }: { read: boolean; signal?: AbortSignal }
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const answer = await http.request({
        method: "POST",
        path: ["admin", "api", SHOPIFY_API_VERSION, "graphql.json"],
        json: { query, variables },
        headers: { "x-shopify-access-token": await token(signal) },
        idempotent: read,
        logPath: `/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        ...(signal ? { signal } : {}),
        schema: Answer,
      })
      const errors = typeof answer.errors === "string" ? [] : (answer.errors ?? [])
      const codes = errors.map((error) => error.extensions?.code)
      if (codes.includes("THROTTLED") && attempt < MAX_THROTTLED) {
        await sleep(THROTTLE_WAIT_MS)
        continue
      }
      if (answer.errors !== undefined && (errors.length > 0 || answer.data === undefined)) {
        throw new ProviderError({
          provider: SHOPIFY_PROVIDER,
          providerCode: codes.includes("ACCESS_DENIED") ? "access_denied" : "graphql_error",
          retryable: codes.includes("THROTTLED"),
        })
      }
      const parsed = schema.safeParse(answer.data)
      if (!parsed.success) {
        throw new ProviderError({
          provider: SHOPIFY_PROVIDER,
          providerCode: "invalid_response",
          retryable: false,
        })
      }
      return parsed.data
    }
  }

  return { token, graphql }
}

export type ShopifyApi = ReturnType<typeof createShopifyApi>

/**
 * Whether the account reaches the store (adr/0027 §4): a token, then the
 * shop's name. Another organization's store, or a wrong id or secret, is
 * the account's fault; anything else says nothing of it.
 */
export async function checkShopify(
  credentials: ShopifyCredentials,
  signal: AbortSignal,
  origin?: string
): Promise<"valid" | "merchant_invalid" | "secret_invalid"> {
  const api = createShopifyApi(credentials, {
    ...(origin ? { origin } : {}),
    retry: { attempts: 1 },
  })
  try {
    await api.graphql("{ shop { name } }", {}, z.looseObject({ shop: z.looseObject({}) }), {
      read: true,
      signal,
    })
    return "valid"
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.providerCode === "oauth_shop_not_permitted") {
        return "merchant_invalid"
      }
      if (["oauth_invalid_client", "http_400", "http_401"].includes(error.providerCode)) {
        return "secret_invalid"
      }
    }
    throw error
  }
}
