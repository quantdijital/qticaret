import { createHash } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions, RequestPath } from "../../clients"
import { ValidationError, isProviderError } from "../../errors"
import {
  DHL_ECOMMERCE_PROVIDER,
  dhlEcomFault,
  dhlEcomGatewayCode,
  field,
  invalid,
  oneOf,
  textOf,
} from "./answers"
import { dhlEcomAppOf } from "./credentials"
import type { DhlEcomApp, DhlEcomCredentials } from "./credentials"
import type { DhlEcomPlace } from "./places"

/**
 * How a call reaches DHL eCommerce (`./client`): the host of the account's
 * mode, the platform's app on every call, the shop's JWT on all but the
 * il/ilçe lists, kept seven of its eight hours per account (a hash of the
 * host, the customer number and the password: a changed password is
 * another key) and asked again once when refused.
 */

export const DHL_ECOMMERCE_TEST_URL = "https://testapi.mngkargo.com.tr"
export const DHL_ECOMMERCE_LIVE_URL = "https://api.mngkargo.com.tr"
export const API = "/mngapi/api"

const TOKEN_TTL_MS = 7 * 60 * 60 * 1000

export interface DhlEcomOptions extends Partial<Omit<HttpClientOptions, "provider">> {
  /** The platform's app; the server's environment unless given. */
  app?: () => DhlEcomApp | null
  /** The waits between `createbarcode` tries while DHL looks for the branch. */
  branchWaitsMs?: readonly number[]
}

export interface Call {
  method: string
  path: RequestPath
  json?: unknown
  idempotent: boolean
  logPath: string
  signal?: AbortSignal | undefined
}

const tokenKey = (base: string, credentials: DhlEcomCredentials): string =>
  createHash("sha256")
    .update(`${base}\0${credentials.customerNumber}\0${credentials.password}`)
    .digest("hex")

// A refused JWT: the gateway's 401, or DHL's own (to confirm with a real account)
const tokenRefused = (error: unknown): boolean =>
  isProviderError(error) && ["http_401", "error_401"].includes(error.providerCode)

export function createDhlEcomSession(options: DhlEcomOptions = {}) {
  const { app: appSource, branchWaitsMs, ...httpOptions } = options
  const sleep =
    httpOptions.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)))
  const now = httpOptions.now ?? Date.now
  const clients = new Map<string, HttpClient>()
  const tokens = new Map<string, { jwt: string; until: number }>()
  const places = new Map<string, { list: DhlEcomPlace[]; until: number }>()

  const baseOf = (testMode: boolean): string =>
    httpOptions.baseUrl ?? (testMode ? DHL_ECOMMERCE_TEST_URL : DHL_ECOMMERCE_LIVE_URL)
  const clientFor = (testMode: boolean): HttpClient => {
    const base = baseOf(testMode)
    let client = clients.get(base)
    if (!client) {
      client = createHttpClient({
        ...httpOptions,
        baseUrl: base,
        provider: DHL_ECOMMERCE_PROVIDER,
        jsonFault: dhlEcomFault,
        errorCode: dhlEcomGatewayCode,
      })
      clients.set(base, client)
    }
    return client
  }
  const appOf = (): DhlEcomApp => {
    const app = (appSource ?? (() => dhlEcomAppOf()))()
    if (!app) {
      throw new ValidationError("dhlecommerce.unavailable")
    }
    return app
  }

  /** One call with the app's keys (and a JWT when given), its answer as sent. */
  function send(testMode: boolean, call: Call, jwt: string | null, secrets: string[]) {
    const app = appOf()
    return clientFor(testMode).request({
      method: call.method,
      path: call.path,
      ...(call.json === undefined ? {} : { json: call.json }),
      headers: {
        "x-ibm-client-id": app.clientId,
        "x-ibm-client-secret": app.clientSecret,
        ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
      },
      idempotent: call.idempotent,
      logPath: call.logPath,
      ...(call.signal ? { signal: call.signal } : {}),
      secrets: [app.clientId, app.clientSecret, ...secrets, ...(jwt ? [jwt] : [])],
      schema: z.unknown(),
    })
  }

  /** The account's JWT: the one kept, else a new one (`POST /token`). */
  async function token(
    credentials: DhlEcomCredentials,
    signal?: AbortSignal,
    fresh = false
  ): Promise<string> {
    const key = tokenKey(baseOf(credentials.testMode), credentials)
    const kept = tokens.get(key)
    if (kept && !fresh && kept.until > now()) {
      return kept.jwt
    }
    const body = await send(
      credentials.testMode,
      {
        method: "POST",
        path: `${API}/token`,
        json: {
          customerNumber: credentials.customerNumber,
          password: credentials.password,
          identityType: 1,
        },
        // A token asked twice is two tokens: nothing is done twice
        idempotent: true,
        logPath: `${API}/token`,
        signal,
      },
      null,
      [credentials.customerNumber, credentials.password]
    )
    const jwt = textOf(field(oneOf(body), "jwt"))
    if (!jwt) {
      throw invalid()
    }
    tokens.set(key, { jwt, until: now() + TOKEN_TTL_MS })
    return jwt
  }

  /** A call on the shop's account; a refused JWT is asked again once. */
  async function authed(credentials: DhlEcomCredentials, call: Call): Promise<unknown> {
    const secrets = [credentials.customerNumber, credentials.password]
    const jwt = await token(credentials, call.signal)
    try {
      return await send(credentials.testMode, call, jwt, secrets)
    } catch (error) {
      if (!tokenRefused(error)) {
        throw error
      }
      const again = await token(credentials, call.signal, true)
      return send(credentials.testMode, call, again, secrets)
    }
  }

  return { baseOf, send, token, authed, sleep, now, places, branchWaitsMs }
}

export type DhlEcomSession = ReturnType<typeof createDhlEcomSession>
