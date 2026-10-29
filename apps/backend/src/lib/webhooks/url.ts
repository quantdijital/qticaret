import { isIP } from "node:net"
import { isBlockedAddress } from "../security/safe-fetch"

/**
 * Where a subscription may send (F11.7, KK3): https, no credentials in the
 * address, no internal host named directly. A name that resolves inside is
 * refused again at every delivery by `safe-fetch`, which checks the
 * address it connects to.
 */
export function webhookUrlProblem(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return "webhook.url_invalid"
  }
  if (url.protocol !== "https:") {
    return "webhook.url_https"
  }
  if (url.username || url.password) {
    return "webhook.url_invalid"
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  const internalName =
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")
  if (internalName || (isIP(host) !== 0 && isBlockedAddress(host))) {
    return "webhook.url_internal"
  }
  if (url.port && url.port !== "443") {
    return "webhook.url_port"
  }
  return null
}
