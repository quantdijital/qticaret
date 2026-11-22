import { createHmac } from "node:crypto"
import { isIP } from "node:net"

/**
 * The shopper's address and its signature for the backend (adr/0046 §5).
 * The header names and the signed text match the backend's
 * `lib/security/client-ip.ts`; a fixed vector is tested on both sides.
 */
export const CLIENT_IP_HEADERS = {
  ip: "x-qt-client-ip",
  time: "x-qt-client-time",
  signature: "x-qt-client-signature",
} as const

export function signClientIp(secret: string, ip: string, unixSeconds: number): string {
  return createHmac("sha256", secret)
    .update(`${String(unixSeconds)}.${ip}`)
    .digest("hex")
}

/**
 * The address the request came from: X-Forwarded-For read from the right,
 * past the proxies we trust to append to it (F16 sets how many), so a
 * value the browser wrote itself is never taken. Null when there is none.
 */
export function visitorIp(headers: Headers, trustedHops = 0): string | null {
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
  // Only X-Forwarded-For, read from the right: a header the client wrote
  // (X-Real-IP, a short chain) is no address of theirs we can trust
  const candidate = forwarded[forwarded.length - 1 - trustedHops]
  const ip = candidate?.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "") ?? null
  return ip !== null && isIP(ip) !== 0 ? ip : null
}

/**
 * Signed in the address's place when the shopper's address could not be
 * read (adr/0076 Ek D5): the backend then counts no shopper by our
 * server's own address, which every such shopper would share.
 */
export const UNKNOWN_VISITOR = "unknown"

/**
 * The three headers, or none without a secret. Without an address the
 * same headers say, signed, that it is unknown.
 */
export function signedVisitorHeaders(
  secret: string | undefined,
  ip: string | null,
  now: number = Math.floor(Date.now() / 1000)
): Record<string, string> {
  if (!secret) {
    return {}
  }
  const value = ip ?? UNKNOWN_VISITOR
  return {
    [CLIENT_IP_HEADERS.ip]: value,
    [CLIENT_IP_HEADERS.time]: String(now),
    [CLIENT_IP_HEADERS.signature]: signClientIp(secret, value, now),
  }
}
