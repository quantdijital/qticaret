import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { safeEqual } from "./timing-safe"

/**
 * The visitor's address as the storefront's server vouches for it (adr/0046
 * §5, docs/04 "imzalı istemci-IP header'ı"). The storefront renders pages and
 * runs the shopper's actions on its own server, so every Store API request
 * reaches us from that one address; rate limits, fraud checks and consent
 * evidence would all see the storefront instead of the shopper.
 *
 * The storefront adds three headers: the shopper's address, the time in
 * Unix seconds and an HMAC-SHA256 of `<time>.<address>` with a secret only
 * the two servers hold (`STOREFRONT_IP_SECRET`). An address is believed only
 * with a valid signature at most 30 seconds old; anything else is ignored and
 * the connection's own address counts, as before.
 */
export const CLIENT_IP_HEADERS = {
  ip: "x-qt-client-ip",
  time: "x-qt-client-time",
  signature: "x-qt-client-signature",
} as const

/** How far the signed time may be from ours, either way, in seconds. */
export const CLIENT_IP_MAX_SKEW_SECONDS = 30

export function signClientIp(secret: string, ip: string, unixSeconds: number): string {
  return createHmac("sha256", secret)
    .update(`${String(unixSeconds)}.${ip}`)
    .digest("hex")
}

type HeaderValue = string | string[] | undefined

const single = (value: HeaderValue): string | undefined =>
  typeof value === "string" ? value.trim() : undefined

/**
 * The signed address, or null when there is none, it is malformed, stale or
 * its signature does not match. A repeated header (an array) never counts.
 */
export function verifiedClientIp(
  headers: Record<string, HeaderValue>,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): string | null {
  if (secret === undefined || secret === "") {
    return null
  }
  const ip = single(headers[CLIENT_IP_HEADERS.ip])
  const time = single(headers[CLIENT_IP_HEADERS.time])
  const signature = single(headers[CLIENT_IP_HEADERS.signature])
  if (ip === undefined || time === undefined || signature === undefined) {
    return null
  }
  if (isIP(ip) === 0 || !/^\d{1,12}$/.test(time) || !/^[0-9a-f]{64}$/i.test(signature)) {
    return null
  }
  const signedAt = Number(time)
  if (Math.abs(nowSeconds - signedAt) > CLIENT_IP_MAX_SKEW_SECONDS) {
    return null
  }
  return safeEqual(signature.toLowerCase(), signClientIp(secret, ip, signedAt)) ? ip : null
}
