import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../clients"
import type { HttpClient, HttpClientOptions } from "../clients"
import type { ProductInput } from "./merchant"
import { GOOGLE_PROVIDER, emailOfIdToken, googleHosts } from "./oauth"
import type { GoogleClient } from "./oauth"

/**
 * Google's token endpoint and Merchant API (F10 M13, adr/0038 §5). A
 * refusal carries Google's own word: OAuth's `error` (`invalid_grant`),
 * Merchant API's `error.status` (`PERMISSION_DENIED`).
 */

const TokenAnswer = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
})

const Named = z.looseObject({ name: z.string().min(1) })

const oauthError = (body: unknown): string | undefined => {
  const error = (body as { error?: unknown } | null)?.error
  return typeof error === "string" ? error : undefined
}

const apiError = (body: unknown): string | undefined => {
  const status = (body as { error?: { status?: unknown } } | null)?.error?.status
  return typeof status === "string" ? status : undefined
}

// A merchant id and a Merchant API name, as path segments that cannot be bent
const MERCHANT_ID = /^\d{1,20}$/
const DATA_SOURCE = /^accounts\/\d{1,20}\/dataSources\/\d{1,20}$/
const PRODUCT_INPUT = /^accounts\/\d{1,20}\/productInputs\/[\w-]{1,400}$/

function checked(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) {
    throw new Error(`google: not a ${what}`)
  }
  return value
}

export function createGoogleApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & {
    oauthUrl?: string
    merchantUrl?: string
  } = {}
) {
  const hosts = googleHosts()
  const oauth: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.oauthUrl ?? hosts.oauth,
    provider: GOOGLE_PROVIDER,
    errorCode: oauthError,
  })
  const merchant: HttpClient = createHttpClient({
    ...options,
    baseUrl: options.merchantUrl ?? hosts.merchant,
    provider: GOOGLE_PROVIDER,
    errorCode: apiError,
  })
  const bearer = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` })

  /** Trades the code Google sent back, with the PKCE verifier; a code works once. */
  async function exchangeCode(
    client: GoogleClient,
    input: { code: string; verifier: string; redirectUri: string }
  ): Promise<{
    refreshToken: string | null
    accessToken: string
    email: string | null
    scopes: string | null
  }> {
    const answer = await oauth.request({
      method: "POST",
      path: "/token",
      form: {
        grant_type: "authorization_code",
        code: input.code,
        code_verifier: input.verifier,
        redirect_uri: input.redirectUri,
        client_id: client.clientId,
        client_secret: client.clientSecret,
      },
      idempotent: false,
      schema: TokenAnswer,
    })
    return {
      refreshToken: answer.refresh_token ?? null,
      accessToken: answer.access_token,
      email: emailOfIdToken(answer.id_token),
      scopes: answer.scope ?? null,
    }
  }

  /** An access token from the shop's refresh token, for one run. */
  async function accessToken(client: GoogleClient, refreshToken: string): Promise<string> {
    const answer = await oauth.request({
      method: "POST",
      path: "/token",
      form: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: client.clientId,
        client_secret: client.clientSecret,
      },
      idempotent: true,
      schema: TokenAnswer,
    })
    return answer.access_token
  }

  /** Ends the platform's access to the shop's account at Google. */
  async function revoke(token: string): Promise<void> {
    await oauth.request({
      method: "POST",
      path: "/revoke",
      form: { token },
      idempotent: true,
      textAnswer: true,
      schema: z.string(),
    })
  }

  /** Whether the token reaches the Merchant Center account: its own record. */
  async function readAccount(token: string, merchantId: string): Promise<void> {
    await merchant.request({
      method: "GET",
      path: ["accounts", "v1", "accounts", checked(merchantId, MERCHANT_ID, "merchant id")],
      headers: bearer(token),
      schema: Named,
    })
  }

  /** An API data source for the shop's products in Turkish, for Türkiye. */
  async function createDataSource(token: string, merchantId: string): Promise<string> {
    const answer = await merchant.request({
      method: "POST",
      path: `/datasources/v1/accounts/${checked(merchantId, MERCHANT_ID, "merchant id")}/dataSources`,
      headers: bearer(token),
      json: {
        displayName: "Quant Ticaret",
        primaryProductDataSource: { contentLanguage: "tr", feedLabel: "TR", countries: ["TR"] },
      },
      idempotent: false,
      schema: Named,
    })
    return checked(answer.name, DATA_SOURCE, "data source")
  }

  /** Inserts or replaces a product (the same offer id, language and label replace it). */
  async function insertProduct(
    token: string,
    merchantId: string,
    dataSource: string,
    input: ProductInput
  ): Promise<void> {
    await merchant.request({
      method: "POST",
      path: `/products/v1/accounts/${checked(merchantId, MERCHANT_ID, "merchant id")}/productInputs:insert`,
      query: { dataSource: checked(dataSource, DATA_SOURCE, "data source") },
      headers: bearer(token),
      json: input,
      idempotent: true,
      schema: Named,
    })
  }

  /** Removes a product no longer sold; gone already is no failure. */
  async function deleteProduct(token: string, name: string, dataSource: string): Promise<void> {
    await merchant.request({
      method: "DELETE",
      path: `/products/v1/${checked(name, PRODUCT_INPUT, "product input")}`,
      query: { dataSource: checked(dataSource, DATA_SOURCE, "data source") },
      headers: bearer(token),
      idempotent: true,
      textAnswer: true,
      schema: z.string(),
    })
  }

  return {
    exchangeCode,
    accessToken,
    revoke,
    readAccount,
    createDataSource,
    insertProduct,
    deleteProduct,
  }
}

export type GoogleApi = ReturnType<typeof createGoogleApi>

let shared: { key: string; api: GoogleApi } | undefined

/** One client per set of hosts (a fake server's in tests). */
export function googleApi(): GoogleApi {
  const key = JSON.stringify(googleHosts())
  if (shared?.key !== key) {
    shared = { key, api: createGoogleApi() }
  }
  return shared.api
}
