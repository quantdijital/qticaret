import type {
  AiFunding,
  AiService,
  ImageEditTarget,
  OpenAiCompatibleTarget,
} from "../registry/services"

/**
 * How a connector's request reaches a service (adr/0085 §3, P4a). The
 * connector builds the body as the service documents it and reads the
 * answer; the transport carries it there and back: with the shop's own
 * key straight to the registry's address (`own-key.ts`), or signed to the
 * control plane's gateway, which adds the platform's key (`platform.ts`).
 * The credential is the transport's alone: a connector never names one.
 */

/** Where a body goes: the registry's service, the target the body is built for, its address. */
export interface AiTransportTarget {
  service: AiService
  target: OpenAiCompatibleTarget | ImageEditTarget
  /** The registry's address of this call (the target's own or its scene's). */
  url: URL
}

export interface AiTransportRequest {
  to: AiTransportTarget
  method: "POST"
  /** The service's body as the connector built it: a JSON text or a multipart's bytes. */
  body: string | Buffer
  /** The body's type and what is accepted; never a credential, the transport adds that. */
  headers: Readonly<Record<string, string>>
  /** The exchange's bound; the connector's own deadline is in `signal` too. */
  timeoutMs: number
  maxResponseBytes: number
  signal: AbortSignal
}

/** The headers of an answer a connector reads, lowercase; nothing else comes back. */
export interface AiTransportHeaders {
  "content-type"?: string
  "retry-after"?: string
}

export interface AiTransportResponse {
  status: number
  headers: AiTransportHeaders
  body: Buffer
}

/**
 * A failure before any answer is thrown: by the own-key transport as
 * `safeFetch` threw it (the connector maps it, adr/0071 §8), by the
 * platform's as a `ProviderError` with our key already (passed on as it is).
 */
export interface AiTransport {
  readonly funding: AiFunding
  /**
   * Whether a connector may send the same body once more after a failure
   * the service did not take (adr/0071 §8). Never on credits: a signed
   * request's nonce is single use and a second call of the operation is
   * the caller's choice (adr/0085 §2).
   */
  readonly retries: boolean
  send: (request: AiTransportRequest) => Promise<AiTransportResponse>
}
