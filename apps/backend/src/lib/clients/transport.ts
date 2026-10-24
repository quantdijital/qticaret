import { isSafeFetchError, safeFetch } from "../security"

export interface TransportRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  timeoutMs: number
  maxResponseBytes: number
  signal?: AbortSignal
}

export interface TransportResponse {
  status: number
  header: (name: string) => string | null
  text: string
}

/** Sends one request; throws for anything that did not produce a response. */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>

/** The transport refused the URL itself (SSRF rules); retrying cannot help. */
export class TransportRefusal extends Error {
  override readonly name = "TransportRefusal"
}

/** The answer was larger than allowed; it would be again. */
export class ResponseTooLarge extends Error {
  override readonly name = "ResponseTooLarge"
}

// fetch would buffer any size; read the stream and stop at the limit
async function readText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel()
    throw new ResponseTooLarge("response too large")
  }
  if (response.body === null) {
    return ""
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      return Buffer.concat(chunks).toString("utf8")
    }
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new ResponseTooLarge("response too large")
    }
    chunks.push(value)
  }
}

/**
 * Node's fetch, for providers at fixed, configured URLs. Redirects are
 * refused: a provider API that redirects is misconfigured, and following
 * would carry credentials to wherever it points.
 */
export const fetchTransport: Transport = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
    redirect: "error",
    signal: request.signal
      ? AbortSignal.any([AbortSignal.timeout(request.timeoutMs), request.signal])
      : AbortSignal.timeout(request.timeoutMs),
  })
  return {
    status: response.status,
    header: (name) => response.headers.get(name),
    text: await readText(response, request.maxResponseBytes),
  }
}

const REFUSALS = new Set([
  "invalid_url",
  "protocol_not_allowed",
  "credentials_in_url",
  "port_not_allowed",
  "address_not_allowed",
  "redirect_not_allowed",
])

/** For URLs a user or tenant supplies (webhooks, feeds): safeFetch rules, no redirects. */
export const safeTransport: Transport = async (request) => {
  try {
    const response = await safeFetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      timeoutMs: request.timeoutMs,
      maxResponseBytes: request.maxResponseBytes,
      redirect: "error",
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    })
    return {
      status: response.status,
      header: (name) => {
        const value = response.headers[name.toLowerCase()]
        return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
      },
      text: response.body.toString("utf8"),
    }
  } catch (error) {
    if (isSafeFetchError(error) && REFUSALS.has(error.reason)) {
      throw new TransportRefusal(`refused: ${error.reason}`, { cause: error })
    }
    if (isSafeFetchError(error) && error.reason === "response_too_large") {
      throw new ResponseTooLarge("response too large", { cause: error })
    }
    throw error
  }
}

export type TransportOutcome = { response: TransportResponse } | { error: unknown }

/**
 * Calls the transport and never rejects. The transport owns the timeout;
 * `backstopMs` ends the call for one that ignores it, and the caller's
 * signal cancels both.
 */
export async function callTransport(
  transport: Transport,
  request: Omit<TransportRequest, "signal">,
  backstopMs: number,
  signal: AbortSignal | undefined
): Promise<TransportOutcome> {
  const controller = new AbortController()
  const backstop = setTimeout(() => {
    controller.abort(new Error("client timeout"))
  }, backstopMs)
  const combined = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal
  const aborted = new Promise<never>((_resolve, reject) => {
    combined.addEventListener(
      "abort",
      () => {
        reject(new Error("aborted"))
      },
      { once: true }
    )
  })
  try {
    return { response: await Promise.race([transport({ ...request, signal: combined }), aborted]) }
  } catch (error) {
    return { error }
  } finally {
    clearTimeout(backstop)
  }
}
