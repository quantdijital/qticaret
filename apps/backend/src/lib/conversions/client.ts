import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../clients"
import type { HttpClient, HttpClientOptions } from "../clients"
import { parseEnv } from "../env"
import { registerProcessCache } from "../cache/process-caches"

/**
 * Meta's Conversions API and GA4's Measurement Protocol (F10.9, adr/0038
 * §4): the shop's own pixel and stream, from its provider accounts
 * (adr/0027). Their secrets travel in the query, as both ask: no path is
 * logged with them.
 */

export const META_PROVIDER = "meta"
export const GA4_PROVIDER = "ga4"
export const META_GRAPH_URL = "https://graph.facebook.com"
export const META_API_VERSION = "v26.0"
export const GA4_URL = "https://www.google-analytics.com"

export interface MetaAccount {
  pixelId: string
  accessToken: string
  /** Meta's Test Events code while the shop tries it out; null in use. */
  testEventCode: string | null
}

export interface Ga4Account {
  measurementId: string
  apiSecret: string
}

interface CredentialsSource {
  settings: Record<string, unknown>
  secrets: Record<string, string>
}

export function metaAccountOf(account: CredentialsSource | null): MetaAccount | null {
  const pixelId = account?.settings["pixel_id"]
  const accessToken = account?.secrets["access_token"]
  const test = account?.settings["test_event_code"]
  return typeof pixelId === "string" && accessToken
    ? { pixelId, accessToken, testEventCode: typeof test === "string" && test ? test : null }
    : null
}

export function ga4AccountOf(account: CredentialsSource | null): Ga4Account | null {
  const measurementId = account?.settings["measurement_id"]
  const apiSecret = account?.secrets["api_secret"]
  return typeof measurementId === "string" && apiSecret ? { measurementId, apiSecret } : null
}

const metaError = (body: unknown): string | undefined => {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code
  return typeof code === "number" ? `meta_${String(code)}` : undefined
}

export function createConversionsApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & {
    metaUrl?: string
    ga4Url?: string
  } = {}
) {
  const meta: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.metaUrl ?? META_GRAPH_URL,
    provider: META_PROVIDER,
    errorCode: metaError,
  })
  const ga4: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.ga4Url ?? GA4_URL,
    provider: GA4_PROVIDER,
  })

  /** Sends server events to the shop's pixel; Meta counts an event id once. */
  async function sendMeta(account: MetaAccount, events: unknown[]): Promise<number> {
    const answer = await meta.request({
      method: "POST",
      path: [META_API_VERSION, account.pixelId, "events"],
      query: { access_token: account.accessToken },
      json: {
        data: events,
        ...(account.testEventCode ? { test_event_code: account.testEventCode } : {}),
      },
      idempotent: true,
      logPath: `/${META_API_VERSION}/:pixel/events`,
      schema: z.looseObject({ events_received: z.number() }),
    })
    return answer.events_received
  }

  /**
   * Whether the token reaches the pixel: the pixel's own record. Meta's
   * code 190 is a token it does not take; 100 a pixel it does not know.
   */
  async function readPixel(account: MetaAccount, signal?: AbortSignal): Promise<void> {
    await meta.request({
      method: "GET",
      path: [META_API_VERSION, account.pixelId],
      query: { fields: "id", access_token: account.accessToken },
      logPath: `/${META_API_VERSION}/:pixel`,
      ...(signal ? { signal } : {}),
      schema: z.looseObject({ id: z.string() }),
    })
  }

  /**
   * Sends events to the shop's GA4 stream for the browser GA4 knows
   * (`client_id`), with the shopper's ad consent; GA4 answers 2xx whatever
   * it makes of them.
   */
  async function sendGa4(
    account: Ga4Account,
    input: { clientId: string; adConsent: boolean; events: unknown[] }
  ): Promise<void> {
    const consent = input.adConsent ? "GRANTED" : "DENIED"
    await ga4.request({
      method: "POST",
      path: "/mp/collect",
      query: { measurement_id: account.measurementId, api_secret: account.apiSecret },
      json: {
        client_id: input.clientId,
        consent: { ad_user_data: consent, ad_personalization: consent },
        events: input.events,
      },
      idempotent: true,
      logPath: "/mp/collect",
      textAnswer: true,
      schema: z.string(),
    })
  }

  return { sendMeta, readPixel, sendGa4 }
}

export type ConversionsApi = ReturnType<typeof createConversionsApi>

let shared: { key: string; api: ConversionsApi } | undefined
// A new client (and circuit breaker) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** One client per set of hosts; a fake server's in tests (`META_GRAPH_BASE_URL`, `GA4_BASE_URL`). */
export function conversionsApi(): ConversionsApi {
  const env = parseEnv()
  const hosts = {
    ...(env.META_GRAPH_BASE_URL ? { metaUrl: env.META_GRAPH_BASE_URL } : {}),
    ...(env.GA4_BASE_URL ? { ga4Url: env.GA4_BASE_URL } : {}),
  }
  const key = JSON.stringify(hosts)
  if (shared?.key !== key) {
    shared = { key, api: createConversionsApi(hosts) }
  }
  return shared.api
}
