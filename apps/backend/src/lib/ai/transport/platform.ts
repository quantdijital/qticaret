import { z } from "zod"
import {
  AI_CALL_RESPONSE_HEADERS,
  aiCallResponseHeadersSchema,
} from "@qticaret/types/control-plane"
import { ProviderError } from "../../errors/errors"
import { aiCallPath, aiGatewayEndpoint, postToAiGateway } from "../../control-plane/ai-gateway"
import type { AiCallTerms, AiGatewayEndpoint } from "../../control-plane/ai-gateway"
import type { Fetch } from "../../control-plane/pull"
import { aiProviderError } from "../errors"
import type { AiErrorKey } from "../errors"
import type { AiTransport, AiTransportResponse } from "./types"

/**
 * The platform's credits (adr/0085 §3, P4a): the connector's body, as it
 * is, signed to the control plane's gateway, which picks the address,
 * adds the platform's key and writes the model and the output cap. The
 * four values that decide the charge go in the signed query. No provider
 * credential is sent from here, and only the body's type and `accept` of
 * the connector's headers go.
 *
 * An answer without the gateway's refusal header is the provider's,
 * passed back as it is for the connector to read (its failure mapping
 * applies), with the credits charged and the wallet left read from the
 * gateway's headers (`lastCharge`). A refusal is an `AiGatewayRefusalError`
 * with our key; the envelope's words and the body never enter an error.
 * Never sent twice: a second call of the operation is the caller's choice.
 */

/** Errors of the gateway itself name this service; a provider's answer names the connector's. */
export const PLATFORM_SERVICE_ID = "platform"

/** The gateway's body cap (adr/0085 §2); checked here first so nothing larger leaves. */
export const AI_GATEWAY_MAX_BODY_BYTES = 6 * 1024 * 1024

/**
 * A refusal's code → our key. Read as a string, not the contract's enum:
 * the gateway may know codes this shop does not; any such is "unavailable".
 */
const REFUSAL_KEYS: Readonly<Record<string, AiErrorKey>> = Object.freeze({
  credits_exhausted: "ai.credits_exhausted",
  daily_cap: "ai.credits_daily_cap",
  call_cap: "ai.platform_unavailable",
  provider_timeout: "ai.timeout",
  provider_unreachable: "ai.provider_unavailable",
  body_refused: "ai.input_unsupported",
  body_too_large: "ai.input_unsupported",
  unavailable: "ai.platform_unavailable",
  task_mismatch: "ai.platform_unavailable",
  not_offered: "ai.platform_unavailable",
})

export const refusalKeyOf = (code: string): AiErrorKey =>
  Object.hasOwn(REFUSAL_KEYS, code)
    ? (REFUSAL_KEYS[code] ?? "ai.platform_unavailable")
    : "ai.platform_unavailable"

const REFUSAL_CODE = /^[a-z][a-z0-9_]{0,63}$/
const refusalEnvelope = z.strictObject({
  qt_ai_gateway: z.strictObject({ code: z.string().regex(REFUSAL_CODE) }),
})

/** The gateway refused before (or instead of) a provider's answer; `refusal` is its code. */
export class AiGatewayRefusalError extends ProviderError {
  readonly refusal: string

  constructor(refusal: string) {
    super({
      provider: PLATFORM_SERVICE_ID,
      providerCode: `gateway_${refusal}`,
      retryable: false,
      safeMessage: refusalKeyOf(refusal),
    })
    this.refusal = refusal
  }
}

export const isAiGatewayRefusal = (value: unknown): value is AiGatewayRefusalError =>
  value instanceof AiGatewayRefusalError

export interface AiCharge {
  credits: number
  balance: number
}

export interface PlatformTransport extends AiTransport {
  /** The last answer's charge and wallet left; null before one, or when it named none. */
  lastCharge: () => AiCharge | null
}

export interface PlatformTransportOptions extends AiCallTerms {
  /** Tests only: where and how to sign; the shop's configuration otherwise. */
  endpoint?: AiGatewayEndpoint | null | undefined
  fetch?: Fetch | undefined
  now?: (() => number) | undefined
}

const unavailable = (code: string) =>
  aiProviderError({ service: PLATFORM_SERVICE_ID, key: "ai.platform_unavailable", code })

function chargeOf(headers: Headers): AiCharge | null {
  const parsed = aiCallResponseHeadersSchema.safeParse({
    [AI_CALL_RESPONSE_HEADERS.charged]: headers.get(AI_CALL_RESPONSE_HEADERS.charged) ?? undefined,
    [AI_CALL_RESPONSE_HEADERS.balance]: headers.get(AI_CALL_RESPONSE_HEADERS.balance) ?? undefined,
  })
  return parsed.success
    ? {
        credits: parsed.data[AI_CALL_RESPONSE_HEADERS.charged],
        balance: parsed.data[AI_CALL_RESPONSE_HEADERS.balance],
      }
    : null
}

function refusalOf(header: string, body: Buffer): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body.toString("utf8"))
  } catch {
    return null
  }
  const envelope = refusalEnvelope.safeParse(parsed)
  // The header and the envelope name the same code, or neither is believed
  return envelope.success && envelope.data.qt_ai_gateway.code === header ? header : null
}

/** Only the body's type and what is accepted go to the gateway. */
function forwardedHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase()
    if (lower === "content-type" || lower === "accept") {
      kept[lower] = value
    }
  }
  return kept
}

/**
 * Throws on an unmanaged or unconfigured shop: the platform's credits
 * exist only where a control plane does.
 */
export function platformTransport(options: PlatformTransportOptions): PlatformTransport {
  const endpoint = options.endpoint === undefined ? aiGatewayEndpoint() : options.endpoint
  if (endpoint === null) {
    throw unavailable("control_plane_not_configured")
  }
  const path = aiCallPath(options)
  let charge: AiCharge | null = null

  return {
    funding: "platform_credit",
    retries: false,
    lastCharge: () => charge,
    async send(request): Promise<AiTransportResponse> {
      charge = null
      if (request.to.service.id !== options.service) {
        // A body built for one service sent as another's: a bug of ours, never sent
        throw unavailable("service_mismatch")
      }
      if (Buffer.byteLength(request.body) > AI_GATEWAY_MAX_BODY_BYTES) {
        // The gateway's own refusal of it (`body_too_large`) means the same; nothing is sent
        throw aiProviderError({
          service: PLATFORM_SERVICE_ID,
          key: refusalKeyOf("body_too_large"),
          code: "body_too_large",
        })
      }
      const exchange = await postToAiGateway({
        endpoint,
        path,
        body: request.body,
        headers: forwardedHeaders(request.headers),
        timeoutMs: request.timeoutMs,
        maxResponseBytes: request.maxResponseBytes,
        signal: request.signal,
        fetch: options.fetch,
        now: options.now,
      })
      if (exchange.kind === "failed") {
        if (exchange.aborted) {
          throw aiProviderError({
            service: PLATFORM_SERVICE_ID,
            key: "ai.timeout",
            code: request.signal.aborted ? "aborted" : "timeout",
          })
        }
        throw unavailable("gateway_unreachable")
      }
      if (exchange.kind === "too_large") {
        throw aiProviderError({
          service: PLATFORM_SERVICE_ID,
          key: "ai.provider_response_invalid",
          code: "response_too_large",
        })
      }
      const { status, headers, body } = exchange
      charge = chargeOf(headers)
      const refusalHeader = headers.get(AI_CALL_RESPONSE_HEADERS.refusal)
      if (refusalHeader !== null) {
        const refusal = refusalOf(refusalHeader, body)
        if (refusal === null) {
          throw unavailable("gateway_refusal_invalid")
        }
        throw new AiGatewayRefusalError(refusal)
      }
      // A provider's 401/403 never comes back (the gateway says `unavailable`): this is the
      // control plane's own (a signature refused); an answer without the charge headers is
      // not one the gateway passed on (its own failure, a proxy's page)
      if (status === 401 || status === 403 || charge === null) {
        throw unavailable(`gateway_http_${String(status)}`)
      }
      const type = headers.get("content-type")
      return { status, headers: type === null ? {} : { "content-type": type }, body }
    },
  }
}
