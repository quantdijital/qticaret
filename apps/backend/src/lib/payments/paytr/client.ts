import { randomBytes } from "node:crypto"
import { createHttpClient } from "../../clients"
import type { HttpClient, HttpClientOptions } from "../../clients"
import { parseEnv } from "../../env"
import { ProviderError, isProviderError } from "../../errors"
import type { Kurus } from "../../money"
import { toPaytrKurus, toPaytrLira } from "./amounts"
import { PAYTR_PROVIDER, paytrError, tokenFailureCode } from "./errors"
import {
  assertMerchantOid,
  encodeBasket,
  flag,
  fromPaytrCurrency,
  lastFour,
  parseRates,
  toPaytrCurrency,
} from "./fields"
import { installmentRatesResponse, refundResponse, statusResponse, tokenResponse } from "./schemas"
import { installmentRatesHash, refundHash, statusQueryHash, tokenRequestHash } from "./signatures"
import type {
  PaytrCredentialCheck,
  PaytrCredentials,
  PaytrInstallmentRates,
  PaytrPaymentStatus,
  PaytrRefund,
  PaytrTokenRequest,
} from "./types"

/**
 * PayTR's APIs (iFrame token, status query, refund, installment rates)
 * over the platform HTTP client: form bodies, Zod-checked answers, PayTR's
 * `err_no` turned into the platform's codes. One client per process keeps
 * one circuit breaker; the shop's account comes with every call, as it may
 * change in the panel at any time (adr/0027). Amounts are read into kuruş
 * by the answer schemas, so a format PayTR was not documented to send is
 * an `invalid_response`, never a stray RangeError.
 */

export const PAYTR_BASE_URL = "https://www.paytr.com"

export type PaytrApi = ReturnType<typeof createPaytrApi>

export function createPaytrApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "errorCode">> = {}
) {
  const http: HttpClient = createHttpClient({
    ...options,
    provider: PAYTR_PROVIDER,
    baseUrl: options.baseUrl ?? PAYTR_BASE_URL,
  })

  /** The token for the iFrame (`https://www.paytr.com/odeme/guvenli/{token}`). */
  async function requestToken(
    credentials: PaytrCredentials,
    request: PaytrTokenRequest
  ): Promise<string> {
    assertMerchantOid(request.merchantOid)
    const hashed = {
      user_ip: request.userIp,
      merchant_oid: request.merchantOid,
      email: request.email,
      payment_amount: toPaytrKurus(request.amount),
      user_basket: encodeBasket(request.basket),
      no_installment: flag(request.noInstallment),
      max_installment: String(request.maxInstallment),
      currency: toPaytrCurrency(request.currencyCode),
      test_mode: flag(credentials.testMode),
    }
    const answer = await http.request({
      method: "POST",
      path: "/odeme/api/get-token",
      form: {
        merchant_id: credentials.merchantId,
        ...hashed,
        paytr_token: tokenRequestHash(credentials, hashed),
        user_name: request.userName,
        user_address: request.userAddress,
        user_phone: request.userPhone,
        merchant_ok_url: request.okUrl,
        merchant_fail_url: request.failUrl,
        timeout_limit: String(request.timeoutMinutes ?? 30),
        // Error texts in the frame while testing only; shoppers see PayTR's own
        debug_on: flag(credentials.testMode),
        lang: request.lang ?? "tr",
      },
      schema: tokenResponse,
    })
    if (answer.status === "failed") {
      throw new ProviderError({
        provider: PAYTR_PROVIDER,
        providerCode: tokenFailureCode(answer.reason),
        retryable: false,
      })
    }
    return answer.token
  }

  /** The payment PayTR holds for `merchantOid`; null when there is no successful one (`004`). */
  async function queryStatus(
    credentials: PaytrCredentials,
    merchantOid: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<PaytrPaymentStatus | null> {
    assertMerchantOid(merchantOid)
    const answer = await http.request({
      method: "POST",
      path: "/odeme/durum-sorgu",
      form: {
        merchant_id: credentials.merchantId,
        merchant_oid: merchantOid,
        paytr_token: statusQueryHash(credentials, merchantOid),
      },
      // A read: safe to send again
      idempotent: true,
      ...(options.signal ? { signal: options.signal } : {}),
      schema: statusResponse,
    })
    if (answer.status !== "success") {
      if (answer.err_no === "004") {
        return null
      }
      throw paytrError("status", answer.err_no)
    }
    return {
      paymentAmount: answer.payment_amount,
      totalAmount: answer.payment_total,
      currencyCode: fromPaytrCurrency(answer.currency),
      installments: Number(answer.taksit ?? 0) || 1,
      cardBrand: answer.kart_marka ?? null,
      cardLast4: lastFour(answer.masked_pan),
      paymentType: answer.odeme_tipi ?? null,
      testMode: answer.test_mode === "1",
      refunds: (answer.returns ?? []).map((entry) => ({
        amount: entry.return_amount,
        date: entry.return_date ?? null,
        referenceNo: entry.reference_no ?? null,
      })),
    }
  }

  /**
   * Refunds `amount` of the payment. Not repeated on its own: PayTR has no
   * idempotency key, so a lost answer is `outcome_unknown` and the caller
   * looks for `referenceNo` in the status query's refunds first (adr/0026 §9).
   */
  async function refund(
    credentials: PaytrCredentials,
    input: { merchantOid: string; amount: Kurus; referenceNo: string }
  ): Promise<PaytrRefund> {
    assertMerchantOid(input.merchantOid)
    assertMerchantOid(input.referenceNo)
    const returnAmount = toPaytrLira(input.amount)
    const answer = await http.request({
      method: "POST",
      path: "/odeme/iade",
      form: {
        merchant_id: credentials.merchantId,
        merchant_oid: input.merchantOid,
        return_amount: returnAmount,
        reference_no: input.referenceNo,
        paytr_token: refundHash(credentials, input.merchantOid, returnAmount),
      },
      schema: refundResponse,
    })
    if (answer.status !== "success") {
      // A `failed` answer without a number: no such order (dev.paytr.com/iade-api)
      throw paytrError("refund", answer.err_no ?? (answer.status === "failed" ? "005" : undefined))
    }
    return {
      amount: answer.return_amount,
      referenceNo: answer.reference_no ?? null,
      testMode: answer.is_test === "1",
    }
  }

  async function installmentRates(credentials: PaytrCredentials): Promise<PaytrInstallmentRates> {
    const requestId = randomBytes(16).toString("hex")
    const answer = await http.request({
      method: "POST",
      path: "/odeme/taksit-oranlari",
      form: {
        merchant_id: credentials.merchantId,
        request_id: requestId,
        paytr_token: installmentRatesHash(credentials, requestId),
      },
      idempotent: true,
      schema: installmentRatesResponse,
    })
    if (answer.status !== "success") {
      throw paytrError("installments", answer.err_no)
    }
    const max = Number(answer.max_inst_non_bus)
    return {
      maxInstallment: Number.isInteger(max) && max > 0 ? max : null,
      rates: parseRates(answer.oranlar),
    }
  }

  /**
   * Asks for an order that cannot exist: PayTR answers "not found" (`004`)
   * only after it accepted the shop number and the signature. A network
   * failure throws; the caller decides what an unreachable PayTR means.
   * `signal` bounds the wait for a person at the panel.
   */
  async function checkCredentials(
    credentials: PaytrCredentials,
    options: { signal?: AbortSignal } = {}
  ): Promise<PaytrCredentialCheck> {
    try {
      await queryStatus(credentials, `QTCHECK${randomBytes(12).toString("hex")}`, options)
      return "valid"
    } catch (error) {
      if (isProviderError(error) && error.providerCode === "merchant_invalid") {
        return "merchant_invalid"
      }
      if (isProviderError(error) && error.providerCode === "token_invalid") {
        return "secret_invalid"
      }
      throw error
    }
  }

  return { requestToken, queryStatus, refund, installmentRates, checkCredentials }
}

let shared: PaytrApi | undefined

/** One client per process, on PayTR's address or a local fake server's (`PAYTR_BASE_URL`). */
export function paytrApi(): PaytrApi {
  shared ??= createPaytrApi({ baseUrl: parseEnv().PAYTR_BASE_URL ?? PAYTR_BASE_URL })
  return shared
}

/** The iFrame's address for a token, on PayTR or on the local fake server (`PAYTR_BASE_URL`). */
export const paytrFormUrl = (token: string): string =>
  `${parseEnv().PAYTR_BASE_URL ?? PAYTR_BASE_URL}/odeme/guvenli/${encodeURIComponent(token)}`
