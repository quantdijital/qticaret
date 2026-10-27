import { createHmac, randomBytes } from "node:crypto"
import { safeEqual } from "../../security"

/**
 * iyzico's signatures (docs.iyzico.com, "HMACSHA256 Auth", 2026-10-27;
 * the request signature checked against the sandbox the same day).
 * - Request (IYZWSv2): hex HMAC-SHA256 of `randomKey + path + body` with
 *   the secret key, sent as `IYZWSv2 base64("apiKey:…&randomKey:…&signature:…")`
 *   with the random key repeated in `x-iyzi-rnd`.
 * - Response: hex HMAC-SHA256 of the answer's values joined by ":", prices
 *   without trailing zeros.
 */

export const requestSignature = (
  secretKey: string,
  randomKey: string,
  path: string,
  body: string
): string =>
  createHmac("sha256", secretKey)
    .update(randomKey + path + body)
    .digest("hex")

export const authorizationHeader = (apiKey: string, randomKey: string, signature: string): string =>
  `IYZWSv2 ${Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`).toString("base64")}`

/** A fresh random key per request: the time, then random digits, as iyzico's examples have it. */
export const newRandomKey = (): string =>
  `${String(Date.now())}${String(randomBytes(4).readUInt32BE() % 1_000_000_000).padStart(9, "0")}`

/** The headers that sign one request; `body` is the exact text sent. */
export function signedHeaders(
  credentials: { apiKey: string; secretKey: string },
  path: string,
  body: string,
  randomKey: string = newRandomKey()
): Record<string, string> {
  return {
    authorization: authorizationHeader(
      credentials.apiKey,
      randomKey,
      requestSignature(credentials.secretKey, randomKey, path, body)
    ),
    "x-iyzi-rnd": randomKey,
  }
}

/** A price as response signatures carry it: "10.50" → "10.5", "10.0" → "10". */
export function signaturePrice(value: string | number): string {
  const text = typeof value === "number" ? String(value) : value
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text
}

export const responseSignature = (secretKey: string, values: readonly string[]): string =>
  createHmac("sha256", secretKey).update(values.join(":")).digest("hex")

export function isResponseGenuine(
  secretKey: string,
  values: readonly string[],
  signature: string | undefined
): boolean {
  return signature !== undefined && safeEqual(signature, responseSignature(secretKey, values))
}
