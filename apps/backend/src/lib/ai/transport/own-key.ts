import type { AiTargetAuth } from "@qticaret/types/control-plane"
import { safeFetch } from "../../security/safe-fetch"
import type { SafeFetchResponse } from "../../security/safe-fetch"
import { aiProviderError } from "../errors"
import type { AiService, ImageEditTarget, OpenAiCompatibleTarget } from "../registry/services"
import type { AiTransport, AiTransportHeaders, AiTransportResponse } from "./types"

/**
 * The shop's own key (adr/0071 §9): `safeFetch` to the registry's
 * address, which must be `https` on the service's host list, redirects
 * refused, the key in the one header the service reads and nowhere else.
 * What `safeFetch` throws is thrown as it is: the connector maps it and
 * may send once more (§8).
 */

export interface OwnKeyOptions {
  /** Tests only. */
  fetch?: typeof safeFetch | undefined
}

/** The header a target's service reads its key from (the shared table's `auth`). */
export function authOf(target: OpenAiCompatibleTarget | ImageEditTarget): AiTargetAuth {
  switch (target.connector) {
    case "openai-compatible":
      return "bearer"
    case "photoroom":
      return "x-api-key"
    case "gemini-image":
      return "x-goog-api-key"
  }
}

/** The key's header, named as the connectors always have. */
function credentialOf(auth: AiTargetAuth, apiKey: string): Record<string, string> {
  switch (auth) {
    case "bearer":
      return { Authorization: `Bearer ${apiKey}` }
    case "x-api-key":
      return { "x-api-key": apiKey }
    case "x-goog-api-key":
      return { "x-goog-api-key": apiKey }
  }
}

/** Whether an address is the registry's kind: `https`, plain, on one of the service's hosts. */
export function onServiceHosts(service: AiService, url: URL): boolean {
  const plain = url.search === "" && url.hash === "" && url.username === "" && url.password === ""
  return url.protocol === "https:" && plain && service.hosts.includes(url.hostname)
}

// A connector names none of these; one that did would not reach the service
const CREDENTIAL_HEADERS: ReadonlySet<string> = new Set([
  "authorization",
  "x-api-key",
  "x-goog-api-key",
])

/** A connector's headers without any credential's name. */
export const withoutCredentials = (
  headers: Readonly<Record<string, string>>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).filter(([name]) => !CREDENTIAL_HEADERS.has(name.toLowerCase()))
  )

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined

/** Only what a connector reads of an answer's headers. */
export function headersOf(response: SafeFetchResponse): AiTransportHeaders {
  const type = single(response.headers["content-type"])
  const retryAfter = single(response.headers["retry-after"])
  return {
    ...(type === undefined ? {} : { "content-type": type }),
    ...(retryAfter === undefined ? {} : { "retry-after": retryAfter }),
  }
}

/** The key stays in this closure; never in a request the caller sees, a result or an error. */
export function ownKeyTransport(apiKey: string, options: OwnKeyOptions = {}): AiTransport {
  const send = options.fetch ?? safeFetch
  return {
    funding: "own_key",
    retries: true,
    async send(request): Promise<AiTransportResponse> {
      const { service, target, url } = request.to
      if (!onServiceHosts(service, url)) {
        throw aiProviderError({
          service: service.id,
          key: "ai.provider_response_invalid",
          code: "endpoint_not_registered",
        })
      }
      const response = await send(url, {
        method: request.method,
        headers: {
          ...credentialOf(authOf(target), apiKey),
          ...withoutCredentials(request.headers),
        },
        body: request.body,
        redirect: "error",
        timeoutMs: request.timeoutMs,
        maxResponseBytes: request.maxResponseBytes,
        signal: request.signal,
      })
      return { status: response.status, headers: headersOf(response), body: response.body }
    },
  }
}

/**
 * How a connector is told to send: through a transport, or, as it always
 * was, with the shop's own key (and, in tests, a `safeFetch` stand-in).
 */
export type ConnectorSending =
  { transport: AiTransport } | { apiKey: string; fetch?: typeof safeFetch | undefined }

export const transportOf = (sending: ConnectorSending): AiTransport =>
  "transport" in sending
    ? sending.transport
    : ownKeyTransport(sending.apiKey, { fetch: sending.fetch })
