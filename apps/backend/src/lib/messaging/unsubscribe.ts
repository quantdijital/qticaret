import { createHmac } from "node:crypto"
import { parseKey, safeEqual } from "@qticaret/server-kit"
import { parseEnv } from "../env"
import { emailLinkUrl } from "./links"

/**
 * One-click unsubscribe (adr/0038 §1, RFC 8058): a link names the
 * recipient by the keyed hash the consent records already use, signed so
 * no one can withdraw someone else's consent, and carries no address.
 * It does not expire: a way out must keep working.
 */

/** Where the link leads on this instance; the backend answers it (`/unsubscribe`). */
export const UNSUBSCRIBE_PATH = "/unsubscribe"

const keyOf = (): Buffer => parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")

const macOf = (key: Buffer, recipientHash: string): string =>
  createHmac("sha256", key)
    .update(`unsubscribe:v1:email:${recipientHash}`, "utf8")
    .digest("base64url")

/** `<recipient hash>.<mac>` for an e-mail recipient. */
export function unsubscribeToken(recipientHash: string, key = keyOf()): string {
  return `${recipientHash}.${macOf(key, recipientHash)}`
}

/** The recipient a token names, or null when it is not one of ours. */
export function recipientOfToken(token: string, key = keyOf()): string | null {
  const match = /^([0-9a-f]{64})\.([\w-]{43})$/.exec(token)
  if (!match?.[1] || !match[2]) {
    return null
  }
  return safeEqual(match[2], macOf(key, match[1])) ? match[1] : null
}

/**
 * The one-click address (RFC 8058, `List-Unsubscribe`): the backend's,
 * which a mail client POSTs to; null where it has no public address yet.
 */
export function unsubscribeUrl(recipientHash: string): string | null {
  const backend = parseEnv().BACKEND_URL
  return backend
    ? `${backend.replace(/\/+$/, "")}${UNSUBSCRIBE_PATH}?${new URLSearchParams({ t: unsubscribeToken(recipientHash) }).toString()}`
    : null
}

/**
 * The way out in the message's body (adr/0038 Ek 2026-11-02): the
 * storefront's page once the shop has a host, else the backend's own.
 */
export function unsubscribePageUrl(
  recipientHash: string,
  storefrontUrl: string | null
): string | null {
  return emailLinkUrl("unsubscribe", unsubscribeToken(recipientHash), storefrontUrl)
}
