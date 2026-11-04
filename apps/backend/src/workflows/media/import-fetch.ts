import { ValidationError, isValidationError } from "../../lib/errors"
import { isSafeFetchError, safeFetch } from "../../lib/security/safe-fetch"
import { DEFAULT_UPLOAD_LIMITS } from "../../lib/security/upload"

const TIMEOUT_MS = 20_000

// The address itself is not one we may reach; anything else is the far side failing
const REFUSED = new Set([
  "invalid_url",
  "protocol_not_allowed",
  "credentials_in_url",
  "port_not_allowed",
  "address_not_allowed",
  "redirect_not_allowed",
])

function refusal(reason: string): ValidationError {
  const key =
    reason === "response_too_large"
      ? "upload.too_large"
      : REFUSED.has(reason)
        ? "media.import_address_refused"
        : "media.import_unreachable"
  return new ValidationError(key, { field: "url" })
}

/**
 * An image's bytes from an address the shop gave, under the SSRF rules
 * (docs/04): public addresses only, every redirect checked again, at most
 * an upload's size (10 MB), 20 seconds. Refusals are validation errors on
 * `url`; the address never reaches a log.
 */
async function fetchImage(address: string): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw refusal("invalid_url")
  }
  try {
    const answer = await safeFetch(url, {
      timeoutMs: TIMEOUT_MS,
      maxResponseBytes: DEFAULT_UPLOAD_LIMITS.maxBytes,
      maxRedirects: 3,
      redirect: "follow",
    })
    if (answer.status !== 200) {
      throw refusal("request_failed")
    }
    return answer.body
  } catch (error) {
    if (isValidationError(error)) {
      throw error
    }
    throw refusal(isSafeFetchError(error) ? error.reason : "request_failed")
  }
}

/**
 * The fetch an address import uses. Tests put a local server's answer in
 * its place: the real one refuses private addresses, which is the point.
 */
export const mediaImportFetch = { get: fetchImage }

/** The name an address suggests for its file: its last path segment. */
export function nameFromAddress(address: string): string {
  try {
    const last = new URL(address).pathname.split("/").pop() ?? ""
    return decodeURIComponent(last) || "gorsel"
  } catch {
    return "gorsel"
  }
}
