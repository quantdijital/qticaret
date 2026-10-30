import { ValidationError } from "../errors"
import { isSafeFetchError, safeFetch } from "../security/safe-fetch"

/**
 * A file at an address the owner gave (an old site's feed), under the
 * SSRF rules (docs/04): public addresses only, every redirect checked
 * again, a size cap. A fake provider's own origin (development, tests)
 * is reached directly, without redirects. Refusals are validation errors
 * under `key` (`…_unreachable`, `…_address_refused`).
 */
export async function fetchOwnersFile(
  address: string,
  options: { key: string; maxBytes: number; timeoutMs: number; fake: string | undefined }
): Promise<Buffer> {
  const refused = (what: "unreachable" | "address_refused") =>
    new ValidationError(`${options.key}_${what}`, { field: "url" })
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw refused("address_refused")
  }
  try {
    if (options.fake && new URL(options.fake).origin === url.origin) {
      const answer = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs),
      })
      if (answer.status !== 200) {
        throw refused("unreachable")
      }
      return Buffer.from(await answer.arrayBuffer())
    }
    const answer = await safeFetch(url, {
      timeoutMs: options.timeoutMs,
      maxResponseBytes: options.maxBytes,
      maxRedirects: 3,
      redirect: "follow",
    })
    if (answer.status !== 200) {
      throw refused("unreachable")
    }
    return answer.body
  } catch (error) {
    if (isSafeFetchError(error)) {
      throw refused(
        [
          "address_not_allowed",
          "protocol_not_allowed",
          "credentials_in_url",
          "port_not_allowed",
        ].includes(error.reason)
          ? "address_refused"
          : "unreachable"
      )
    }
    throw error
  }
}
