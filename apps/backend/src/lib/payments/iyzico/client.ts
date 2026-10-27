import { randomBytes } from "node:crypto"
import type { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { parseEnv } from "../../env"
import { isProviderError } from "../../errors"
import { IYZICO_PROVIDER, iyzicoError } from "./errors"
import { iyzicoAnswer } from "./schemas"
import { signedHeaders } from "./signatures"
import type { IyzicoCredentialCheck, IyzicoCredentials } from "./types"

/**
 * iyzico's API over the platform HTTP client, signed per request
 * (IYZWSv2). The sandbox and the live service have their own addresses
 * and their own keys; the account's test mode picks one. Each has its own
 * client, so a sandbox outage never opens the live circuit breaker. The
 * shop's account comes with every call (adr/0027). The payment calls join
 * in F5 V9 and V10.
 */

export const IYZICO_SANDBOX_URL = "https://sandbox-api.iyzipay.com"
export const IYZICO_LIVE_URL = "https://api.iyzipay.com"

const INSTALLMENT_PATH = "/payment/iyzipos/installment"

export type IyzicoApi = ReturnType<typeof createIyzicoApi>

export function createIyzicoApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "errorCode" | "baseUrl">> & {
    sandboxUrl?: string
    liveUrl?: string
  } = {}
) {
  const { sandboxUrl = IYZICO_SANDBOX_URL, liveUrl = IYZICO_LIVE_URL, ...rest } = options
  const sandbox: HttpClient = createHttpClient({
    ...rest,
    provider: IYZICO_PROVIDER,
    baseUrl: sandboxUrl,
  })
  const live: HttpClient = createHttpClient({
    ...rest,
    provider: IYZICO_PROVIDER,
    baseUrl: liveUrl,
  })

  /** One signed call; a `failure` answer throws iyzico's error code. */
  async function post<T extends z.infer<typeof iyzicoAnswer>>(
    credentials: IyzicoCredentials,
    path: string,
    payload: Record<string, unknown>,
    schema: z.ZodType<T>,
    call: { idempotent?: boolean; signal?: AbortSignal | undefined } = {}
  ): Promise<T> {
    // The client sends JSON.stringify of the same object: the text signed is the text sent
    const body = JSON.stringify(payload)
    const answer = await (credentials.testMode ? sandbox : live).request({
      method: "POST",
      path,
      headers: signedHeaders(credentials, path, body),
      json: payload,
      ...(call.idempotent ? { idempotent: true } : {}),
      ...(call.signal ? { signal: call.signal } : {}),
      schema,
    })
    if (answer.status !== "success") {
      throw iyzicoError(answer.errorCode)
    }
    return answer
  }

  /**
   * Asks for the installment table of a 1 TL payment, a read that changes
   * nothing: iyzico answers it only to a known API key (else `1001`) with a
   * matching signature (else `1000`), at the address of the account's mode.
   * A network failure throws; the caller decides what an unreachable iyzico
   * means. `signal` bounds the wait for a person at the panel.
   */
  async function checkCredentials(
    credentials: IyzicoCredentials,
    options: { signal?: AbortSignal } = {}
  ): Promise<IyzicoCredentialCheck> {
    try {
      await post(
        credentials,
        INSTALLMENT_PATH,
        {
          locale: "tr",
          conversationId: `qtcheck-${randomBytes(8).toString("hex")}`,
          price: "1.0",
        },
        iyzicoAnswer,
        { idempotent: true, signal: options.signal }
      )
      return "valid"
    } catch (error) {
      if (isProviderError(error) && error.providerCode === "api_key_invalid") {
        return "merchant_invalid"
      }
      if (isProviderError(error) && error.providerCode === "signature_invalid") {
        return "secret_invalid"
      }
      throw error
    }
  }

  return { checkCredentials }
}

let shared: IyzicoApi | undefined

/** One client per process, on iyzico's addresses or a local fake server's (`IYZICO_BASE_URL`). */
export function iyzicoApi(): IyzicoApi {
  const fake = parseEnv().IYZICO_BASE_URL
  shared ??= createIyzicoApi(fake ? { sandboxUrl: fake, liveUrl: fake } : {})
  return shared
}
