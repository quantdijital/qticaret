import { isIP } from "node:net"
import { isBlockedAddress } from "../security/safe-fetch"

// Names only a private network resolves: no shop's system on the internet has one
const INTERNAL_SUFFIXES = [
  "localhost",
  "local",
  "internal",
  "lan",
  "home.arpa",
  "intranet",
  "corp",
  "home",
]

const isInternalName = (host: string) =>
  !host.includes(".") ||
  INTERNAL_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))

/**
 * Where a subscription may send (F11.7, KK3): https, no credentials in the
 * address, no internal host named directly (an address, a single-label
 * name, a private network's suffix). A name that resolves inside is
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
  const host = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase()
  const blocked = isIP(host) !== 0 ? isBlockedAddress(host) : isInternalName(host)
  if (blocked) {
    return "webhook.url_internal"
  }
  if (url.port && url.port !== "443") {
    return "webhook.url_port"
  }
  return null
}

/**
 * A failed delivery as the delivery log shows it: the receiver's HTTP
 * status, or a coarse reason. Whether a name resolved inside or not at
 * all stays in the server's log: a key that may point a subscription
 * anywhere would otherwise map the shop's private names. A timeout is
 * only ever an address outside, so it is told.
 */
export function shownFailure(code: string | null): string | null {
  if (code === null || /^http_\d{3}$/.test(code)) {
    return code
  }
  if (code === "timeout" || code === "response_too_large") {
    return code
  }
  return code === "redirect_not_allowed" || code === "too_many_redirects"
    ? "redirect"
    : "unreachable"
}
