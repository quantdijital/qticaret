import { randomBytes } from "node:crypto"
import type { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { parseEnv } from "../../env"
import { ProviderError, isProviderError } from "../../errors"
import {
  INITIALIZE_PATH,
  RETRIEVE_PATH,
  checkoutFormRequest,
  checkoutFormResult,
  initializeAnswer,
  retrieveAnswer,
} from "./checkout-form"
import type { CheckoutFormInput, CheckoutFormResult } from "./checkout-form"
import { IYZICO_PROVIDER, iyzicoError } from "./errors"
import { createInstallmentCache, installmentAnswer } from "./installments"
import { refundCalls } from "./refund-calls"
import { iyzicoAnswer } from "./schemas"
import { statementCalls } from "./statement"
import { isResponseGenuine, signaturePrice, signedHeaders } from "./signatures"
import type { IyzicoCredentialCheck, IyzicoCredentials } from "./types"
import { toIyzicoPrice } from "./amounts"
import type { Kurus } from "../../money"
import { registerProcessCache } from "../../cache/process-caches"

/**
 * iyzico's API over the platform HTTP client, signed per request
 * (IYZWSv2). The sandbox and the live service have their own addresses
 * and their own keys; the account's test mode picks one. Each has its own
 * client, so a sandbox outage never opens the live circuit breaker. The
 * shop's account comes with every call (adr/0027). Answers that move money
 * are checked against their signature; refund, cancel and the payment
 * detail are in `refund-calls.ts`.
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

  /** A `failure` answer throws iyzico's error code; a success is read by the call's schema. */
  function readAnswer<T>(answer: z.infer<typeof iyzicoAnswer>, schema: z.ZodType<T>): T {
    if (answer.status !== "success") {
      throw iyzicoError(answer.errorCode)
    }
    const read = schema.safeParse(answer)
    if (!read.success) {
      throw new ProviderError({
        provider: IYZICO_PROVIDER,
        providerCode: "invalid_response",
        retryable: false,
        cause: read.error,
      })
    }
    return read.data
  }

  /**
   * One signed call; a `failure` answer throws iyzico's error code. The
   * call's own `schema` reads a successful answer only: a failure carries
   * none of its fields.
   */
  async function post<T>(
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
      schema: iyzicoAnswer.loose(),
    })
    return readAnswer(answer, schema)
  }

  /** A signed GET (the reports): the signature covers the path, never the query. */
  async function get<T>(
    credentials: IyzicoCredentials,
    path: string,
    query: Record<string, string>,
    schema: z.ZodType<T>
  ): Promise<T> {
    const answer = await (credentials.testMode ? sandbox : live).request({
      method: "GET",
      path,
      query,
      headers: signedHeaders(credentials, path, ""),
      schema: iyzicoAnswer.loose(),
    })
    return readAnswer(answer, schema)
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

  // A signed answer that does not match was not iyzico's: nothing is decided on it
  const forged = () =>
    new ProviderError({
      provider: IYZICO_PROVIDER,
      providerCode: "signature_mismatch",
      retryable: false,
    })

  /** Opens a checkout form; creates a payable token, so it is never sent twice. */
  async function initializeCheckoutForm(credentials: IyzicoCredentials, input: CheckoutFormInput) {
    const answer = await post(
      credentials,
      INITIALIZE_PATH,
      checkoutFormRequest(input),
      initializeAnswer
    )
    if (
      !isResponseGenuine(
        credentials.secretKey,
        [answer.conversationId, answer.token],
        answer.signature
      )
    ) {
      throw forged()
    }
    return {
      token: answer.token,
      pageUrl: answer.paymentPageUrl,
      expiresAt: new Date(Date.now() + answer.tokenExpireTime * 1000),
    }
  }

  /**
   * A form's result: null while nothing was paid with it (`5122`). A paid
   * result must carry iyzico's signature over its amounts and references.
   */
  async function retrieveCheckoutForm(
    credentials: IyzicoCredentials,
    form: { conversationId: string; token: string }
  ): Promise<CheckoutFormResult | null> {
    let answer
    try {
      answer = await post(
        credentials,
        RETRIEVE_PATH,
        { locale: "tr", conversationId: form.conversationId, token: form.token },
        retrieveAnswer,
        { idempotent: true }
      )
    } catch (error) {
      if (isProviderError(error) && error.providerCode === "form_unpaid") {
        return null
      }
      throw error
    }
    if (answer.paymentStatus === "SUCCESS") {
      const signed = [
        answer.paymentStatus,
        answer.paymentId,
        answer.currency,
        answer.basketId,
        answer.conversationId,
        answer.paidPrice === undefined ? undefined : signaturePrice(answer.paidPrice),
        answer.price === undefined ? undefined : signaturePrice(answer.price),
        answer.token,
      ]
      if (
        signed.some((value) => value === undefined) ||
        !isResponseGenuine(credentials.secretKey, signed as string[], answer.signature)
      ) {
        throw forged()
      }
    }
    return checkoutFormResult(answer)
  }

  const installments = createInstallmentCache()

  /** The installment table for an amount, by card family, without a card number (cached briefly). */
  async function installmentTable(credentials: IyzicoCredentials, amount: Kurus) {
    const key = `${credentials.testMode ? "sandbox" : "live"}:${String(amount)}`
    const cached = installments.get(key)
    if (cached) {
      return cached
    }
    const answer = await post(
      credentials,
      INSTALLMENT_PATH,
      {
        locale: "tr",
        conversationId: `qtinst-${randomBytes(8).toString("hex")}`,
        price: toIyzicoPrice(amount),
      },
      installmentAnswer,
      { idempotent: true }
    )
    installments.set(key, answer)
    return answer
  }

  return {
    ...refundCalls(post, forged),
    ...statementCalls(get),
    checkCredentials,
    initializeCheckoutForm,
    retrieveCheckoutForm,
    installmentTable,
  }
}

let shared: IyzicoApi | undefined
// A new client (and circuit breaker) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** One client per process, on iyzico's addresses or a local fake server's (`IYZICO_BASE_URL`). */
export function iyzicoApi(): IyzicoApi {
  const fake = parseEnv().IYZICO_BASE_URL
  shared ??= createIyzicoApi(fake ? { sandboxUrl: fake, liveUrl: fake } : {})
  return shared
}
