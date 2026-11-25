import { logger } from "../logging"
import { isSafeFetchError, safeFetch } from "../security/safe-fetch"
import { aiProviderError } from "./errors"
import type { AiService } from "./registry/services"

/**
 * A result file a service names by its address (adr/0071 §9): fetched
 * only from the service's `downloadHosts`, over https, with `safeFetch`
 * (public addresses, no redirect), within a size cap, and only when it
 * says it is a raster image (never SVG). An address off the list is
 * `ai.provider_response_invalid` and is not fetched at all. The bytes are
 * still untrusted: the upload check reads them next (`run-image.ts`).
 */

/** The largest result file fetched; well past a 36 MP cut-out. */
export const MAX_RESULT_BYTES = 40 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 60_000

const RESULT_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
])

export interface DownloadOptions {
  signal?: AbortSignal | undefined
  maxBytes?: number
  /** Tests only. */
  fetch?: typeof safeFetch | undefined
}

/** The address when the service may name it; null for any other. */
export function listedResultUrl(service: AiService, raw: string): URL | null {
  if (!URL.canParse(raw)) {
    return null
  }
  const url = new URL(raw)
  const plain = url.username === "" && url.password === "" && url.port === ""
  return url.protocol === "https:" && plain && service.downloadHosts.includes(url.hostname)
    ? url
    : null
}

export async function downloadResult(
  service: AiService,
  raw: string,
  options: DownloadOptions = {}
): Promise<Buffer> {
  const refuse = (code: string) =>
    aiProviderError({ service: service.id, key: "ai.provider_response_invalid", code })
  const url = listedResultUrl(service, raw)
  if (url === null) {
    // The host alone, for the operator to see where a service's results are (Bria's
    // is not documented); never the address, whose path or query may be a signed token
    const host = URL.canParse(raw) ? new URL(raw).hostname.slice(0, 253) : "unreadable"
    logger.warn({ event: "ai.download_host_not_listed", service: service.id, host })
    throw refuse("download_host_not_listed")
  }
  let response
  try {
    response = await (options.fetch ?? safeFetch)(url, {
      method: "GET",
      headers: { Accept: [...RESULT_TYPES].join(", ") },
      redirect: "error",
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      maxResponseBytes: options.maxBytes ?? MAX_RESULT_BYTES,
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (error) {
    // The reason alone: the address may carry a signed token
    const reason = isSafeFetchError(error) ? error.reason : "unexpected"
    if (reason === "timeout" || reason === "aborted") {
      throw aiProviderError({ service: service.id, key: "ai.timeout", code: `download_${reason}` })
    }
    if (reason === "dns_failed" || reason === "request_failed") {
      throw aiProviderError({
        service: service.id,
        key: "ai.provider_unavailable",
        code: `download_${reason}`,
      })
    }
    throw refuse(`download_${reason}`)
  }
  if (response.status !== 200) {
    throw refuse(`download_http_${String(response.status)}`)
  }
  const header = response.headers["content-type"]
  const type = (typeof header === "string" ? header : "").split(";")[0]?.trim().toLowerCase()
  if (type === undefined || !RESULT_TYPES.has(type)) {
    throw refuse("download_not_an_image")
  }
  return response.body
}
