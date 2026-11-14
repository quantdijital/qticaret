import type { LookupAddress } from "node:dns"
import http from "node:http"
import type { IncomingHttpHeaders, IncomingMessage } from "node:http"
import https from "node:https"
import { isIP } from "node:net"
import { isBlockedAddress } from "./address-policy"
import { SafeFetchError } from "./errors"
import { nextHop } from "./redirect-policy"
import type { Hop, RedirectMode } from "./redirect-policy"
import { raceAbort, systemResolver } from "./resolver"
import type { Resolver } from "./resolver"
import { DEFAULT_ALLOWED_PORTS, checkUrl } from "./url-policy"
import type { CheckedUrl } from "./url-policy"

/**
 * HTTP(S) requests to URLs a user or tenant controls (docs/04 SSRF): only
 * public addresses, checked after DNS and pinned for the connection so a
 * second DNS answer cannot point inside (rebinding); redirects checked
 * again at every hop; bounded time and response size.
 */

export interface SafeFetchOptions {
  method?: string
  headers?: Readonly<Record<string, string>>
  body?: string | Buffer
  /** Whole exchange, DNS and redirects included. */
  timeoutMs?: number
  maxResponseBytes?: number
  maxRedirects?: number
  redirect?: RedirectMode
  allowedPorts?: readonly number[]
  signal?: AbortSignal
}

export interface SafeFetchResponse {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
  /** The URL that answered, after redirects. */
  url: string
}

export interface SafeFetchDependencies {
  resolve: Resolver
  isAddressAllowed: (address: string) => boolean
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const DEFAULT_MAX_REDIRECTS = 5
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const BODILESS_STATUSES = new Set([204, 304])

async function pinAddress(
  checked: CheckedUrl,
  deps: SafeFetchDependencies,
  signal: AbortSignal
): Promise<LookupAddress> {
  let addresses: readonly LookupAddress[]
  if (checked.literalAddress !== null) {
    addresses = [{ address: checked.literalAddress, family: isIP(checked.literalAddress) }]
  } else {
    try {
      addresses = await raceAbort(deps.resolve(checked.host, signal), signal)
    } catch (error) {
      if (signal.aborted) {
        throw error
      }
      throw new SafeFetchError("dns_failed", { cause: error })
    }
  }
  const [first] = addresses
  if (first === undefined) {
    throw new SafeFetchError("dns_failed")
  }
  // One disallowed answer is enough: the attacker decides which one a client picks
  if (addresses.some(({ address }) => !deps.isAddressAllowed(address))) {
    throw new SafeFetchError("address_not_allowed")
  }
  return first
}

function send(checked: CheckedUrl, pinned: LookupAddress, hop: Hop, signal: AbortSignal) {
  const transport = checked.url.protocol === "https:" ? https : http
  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = transport.request(
      {
        hostname: checked.host,
        port: checked.port,
        path: `${checked.url.pathname}${checked.url.search}`,
        method: hop.method,
        headers: hop.headers,
        // A fresh connection to the pinned address; a pooled socket would skip `lookup`
        agent: false,
        signal,
        // Connect to the address that was checked, never to a new DNS answer;
        // TLS still verifies the certificate against the hostname
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [pinned])
          } else {
            callback(null, pinned.address, pinned.family)
          }
        },
      },
      resolve
    )
    request.on("error", reject)
    request.end(hop.body)
  })
}

async function readBody(response: IncomingMessage, maxBytes: number, method: string) {
  const status = response.statusCode ?? 0
  // HEAD, 204 and 304 declare a length but carry no body
  const hasBody = method !== "HEAD" && !BODILESS_STATUSES.has(status)
  const declared = Number(response.headers["content-length"])
  if (hasBody && Number.isFinite(declared) && declared > maxBytes) {
    response.destroy()
    throw new SafeFetchError("response_too_large", { status })
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of response) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > maxBytes) {
      response.destroy()
      throw new SafeFetchError("response_too_large", { status })
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

function positive(name: string, value: number | undefined, fallback: number, min = 1): number {
  const chosen = value ?? fallback
  // NaN or Infinity would silently lift a limit; a wrong option is a bug
  if (!Number.isSafeInteger(chosen) || chosen < min) {
    throw new RangeError(`safeFetch: ${name} must be an integer of at least ${String(min)}`)
  }
  return chosen
}

function toSafeFetchError(error: unknown, timeout: AbortSignal, caller: AbortSignal | undefined) {
  if (error instanceof SafeFetchError) {
    return error
  }
  if (timeout.aborted) {
    return new SafeFetchError("timeout", { cause: error })
  }
  if (caller?.aborted) {
    return new SafeFetchError("aborted", { cause: error })
  }
  return new SafeFetchError("request_failed", { cause: error })
}

async function run(
  deps: SafeFetchDependencies,
  input: string | URL,
  options: SafeFetchOptions
): Promise<SafeFetchResponse> {
  const maxBytes = positive(
    "maxResponseBytes",
    options.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES
  )
  const maxRedirects = positive("maxRedirects", options.maxRedirects, DEFAULT_MAX_REDIRECTS, 0)
  const timeout = AbortSignal.timeout(positive("timeoutMs", options.timeoutMs, DEFAULT_TIMEOUT_MS))
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout
  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS
  let hop: Hop = {
    method: (options.method ?? "GET").toUpperCase(),
    headers: { ...options.headers },
    ...(options.body === undefined ? {} : { body: options.body }),
  }
  let target: string | URL = input
  try {
    for (let redirects = 0; ; redirects++) {
      const checked = checkUrl(target, allowedPorts)
      const pinned = await pinAddress(checked, deps, signal)
      const response = await send(checked, pinned, hop, signal)
      const status = response.statusCode ?? 0
      const location = response.headers.location
      if (!REDIRECT_STATUSES.has(status) || location === undefined) {
        const body = await readBody(response, maxBytes, hop.method)
        return { status, headers: response.headers, body, url: checked.url.href }
      }
      // With `agent: false` there is no connection to keep; an endless body must not stream on
      response.destroy()
      if (redirects >= maxRedirects) {
        throw new SafeFetchError("too_many_redirects")
      }
      if (!URL.canParse(location, checked.url)) {
        throw new SafeFetchError("invalid_url")
      }
      const next = new URL(location, checked.url)
      hop = nextHop(status, hop, checked.url, next, options.redirect ?? "same-origin")
      target = next
    }
  } catch (error) {
    throw toSafeFetchError(error, timeout, options.signal)
  }
}

/**
 * Tests only: DNS and the address rule injected. Not exported from the
 * library, since an `isAddressAllowed` that allows everything turns the SSRF
 * protection off. One other user: the storefront refresh, which allows
 * loopback on a developer's machine and in tests only (lib/storefront/refresh.ts).
 */
export function createSafeFetch(deps: SafeFetchDependencies) {
  return (input: string | URL, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> =>
    run(deps, input, options)
}

/**
 * Fetches `input` under the SSRF rules. Throws `SafeFetchError` for a
 * refusal or a failure, and a RangeError for an invalid limit option.
 */
export const safeFetch = createSafeFetch({
  resolve: systemResolver,
  isAddressAllowed: (address) => !isBlockedAddress(address),
})
