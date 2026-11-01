import { createHmac } from "node:crypto"
import { safeEqual } from "../security/timing-safe"

/**
 * A draft's preview link (F18, PROGRESS T10 "imzalı önizleme"): an HMAC
 * binding the content entry and an end, keyed with `PII_HASH_KEY` under its
 * own context, so the link opens that entry only, for a day, whatever its
 * status; nothing is stored. Staff make it from the panel.
 */

export const PREVIEW_HOURS = 24

/** The storefront's preview page: `/onizleme/<token>`. */
export const PREVIEW_PATH = "/onizleme"

const HOUR_MS = 60 * 60 * 1000

const macOf = (key: Buffer, entryId: string, expires: string): string =>
  createHmac("sha256", key)
    .update(`content-preview:v1:${entryId}:${expires}`, "utf8")
    .digest("base64url")

/** `<entry id>.<end, base 36 seconds>.<mac>`. */
export function previewToken(
  key: Buffer,
  entryId: string,
  now = new Date()
): { token: string; expires_at: Date } {
  const end = Math.floor((now.getTime() + PREVIEW_HOURS * HOUR_MS) / 1000)
  const expires = end.toString(36)
  return {
    token: `${entryId}.${expires}.${macOf(key, entryId, expires)}`,
    expires_at: new Date(end * 1000),
  }
}

/** The entry the token opens now; null when it is malformed, changed or past its end. */
export function previewEntryOf(key: Buffer, token: string, now = new Date()): string | null {
  const match = /^(cnt_[0-9A-Za-z]{1,40})\.([0-9a-z]{1,12})\.([\w-]{43})$/.exec(token)
  if (!match?.[1] || !match[2] || !match[3]) {
    return null
  }
  if (parseInt(match[2], 36) * 1000 <= now.getTime()) {
    return null
  }
  return safeEqual(match[3], macOf(key, match[1], match[2])) ? match[1] : null
}
