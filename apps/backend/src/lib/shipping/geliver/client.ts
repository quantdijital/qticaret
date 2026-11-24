import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions, HttpRequest } from "../../clients"
import { parseEnv } from "../../env"
import { ProviderError, isProviderError } from "../../errors"
import { GELIVER_PROVIDER, geliverBodyCode, geliverError, isTokenRefused } from "./errors"
import { quoteCalls } from "./quotes"
import { shipmentCalls } from "./shipments"
import { geliverAddress, geliverAddressList, geliverEnvelope } from "./schemas"
import type { GeliverAddress } from "./schemas"
import type { GeliverCredentialCheck, GeliverCredentials } from "./types"
import { registerProcessCache } from "../../cache/process-caches"

/**
 * Geliver's API over the platform HTTP client (adr/0031): a Bearer token
 * per call (the shop's account, adr/0027), answers in an envelope whose
 * `result: false` is a refusal. Test shipments go to the same address
 * with a flag on the shipment, so one client serves both modes. Shipments
 * are in `shipments.ts`.
 */

export const GELIVER_URL = "https://api.geliver.io/api/v1"

export type GeliverCall = <T>(
  credentials: GeliverCredentials,
  request: Omit<HttpRequest<unknown>, "schema" | "headers">,
  schema: z.ZodType<T>
) => Promise<T>

/** A sender address as Geliver takes it: a Turkish address with a phone and a postcode. */
export interface GeliverSenderInput {
  name: string
  email: string
  phone: string
  address1: string
  address2?: string | undefined
  countryCode: "TR"
  cityName: string
  /** The province's plate code ("34"). */
  cityCode: string
  districtName: string
  zip: string
  /** Our marker for the stock location it stands for. */
  shortName: string
}

export type GeliverApi = ReturnType<typeof createGeliverApi>

export function createGeliverApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "errorCode">> = {}
) {
  const client = createHttpClient({
    baseUrl: GELIVER_URL,
    ...options,
    provider: GELIVER_PROVIDER,
    errorCode: geliverBodyCode,
  })

  const call: GeliverCall = async (credentials, request, schema) => {
    const answer = await client.request({
      ...request,
      headers: { authorization: `Bearer ${credentials.token}` },
      schema: geliverEnvelope,
    })
    if (answer.result === false) {
      throw geliverError(answer.code)
    }
    const read = schema.safeParse(answer.data)
    if (!read.success) {
      throw new ProviderError({
        provider: GELIVER_PROVIDER,
        providerCode: "invalid_response",
        retryable: false,
        cause: read.error,
      })
    }
    return read.data
  }

  /**
   * Lists one sender address, a read that changes nothing: Geliver answers
   * it only to a known token. A network failure throws; the caller decides
   * what an unreachable Geliver means.
   */
  async function checkCredentials(
    credentials: GeliverCredentials,
    options: { signal?: AbortSignal } = {}
  ): Promise<GeliverCredentialCheck> {
    try {
      await call(
        credentials,
        {
          method: "GET",
          path: "/addresses",
          query: { isRecipientAddress: false, limit: 1 },
          ...(options.signal ? { signal: options.signal } : {}),
        },
        geliverAddressList
      )
      return "valid"
    } catch (error) {
      if (isProviderError(error) && isTokenRefused(error.providerCode)) {
        return "secret_invalid"
      }
      throw error
    }
  }

  /** The account's sender addresses (the first hundred: a shop has a few warehouses). */
  const senderAddresses = (credentials: GeliverCredentials): Promise<GeliverAddress[]> =>
    call(
      credentials,
      { method: "GET", path: "/addresses", query: { isRecipientAddress: false, limit: 100 } },
      geliverAddressList
    )

  /** Creates a sender address; not repeated on a failure whose outcome is unknown. */
  const createSenderAddress = (credentials: GeliverCredentials, input: GeliverSenderInput) =>
    call(
      credentials,
      { method: "POST", path: "/addresses", json: { ...input, isRecipientAddress: false } },
      geliverAddress
    )

  /** Removes an address (undoing a create whose save failed). */
  const deleteAddress = async (credentials: GeliverCredentials, id: string): Promise<void> => {
    await call(credentials, { method: "DELETE", path: ["addresses", id] }, z.unknown())
  }

  return {
    ...quoteCalls(call),
    ...shipmentCalls(call),
    call,
    checkCredentials,
    senderAddresses,
    createSenderAddress,
    deleteAddress,
  }
}

let shared: GeliverApi | undefined
// A new client (and circuit breaker) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** One client per process, on Geliver's address or a local fake server's (`GELIVER_BASE_URL`). */
export function geliverApi(): GeliverApi {
  const fake = parseEnv().GELIVER_BASE_URL
  shared ??= createGeliverApi(fake ? { baseUrl: fake } : {})
  return shared
}
