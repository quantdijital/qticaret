import { createHmac } from "node:crypto"
import { safeEqual } from "../security/timing-safe"

/**
 * A draft's preview link (F18, PROGRESS T10 "imzalı önizleme"): an HMAC
 * binding the content entry, the moment it was last saved and an end,
 * keyed with `PII_HASH_KEY` under its own context. It opens that entry as
 * it was when the link was made, for a day: a later save ends it, so a
 * link sent to someone shows them nothing written after (security review
 * 2026-11-02). Nothing is stored; staff make a new link from the panel.
 */

export const PREVIEW_HOURS = 24

/** The storefront's preview page: `/onizleme/<token>`. */
export const PREVIEW_PATH = "/onizleme"

const HOUR_MS = 60 * 60 * 1000

const macOf = (key: Buffer, entryId: string, expires: string, savedAt: Date): string =>
  createHmac("sha256", key)
    .update(`content-preview:v2:${entryId}:${expires}:${String(savedAt.getTime())}`, "utf8")
    .digest("base64url")

/** `<entry id>.<end, base 36 seconds>.<mac>`. */
export function previewToken(
  key: Buffer,
  entry: { id: string; updated_at: Date | string },
  now = new Date()
): { token: string; expires_at: Date } {
  const end = Math.floor((now.getTime() + PREVIEW_HOURS * HOUR_MS) / 1000)
  const expires = end.toString(36)
  return {
    token: `${entry.id}.${expires}.${macOf(key, entry.id, expires, new Date(entry.updated_at))}`,
    expires_at: new Date(end * 1000),
  }
}

export interface PreviewTokenParts {
  entryId: string
  expires: string
  mac: string
}

/** The token's parts while it is well formed and before its end; null otherwise. */
export function previewTokenParts(token: string, now = new Date()): PreviewTokenParts | null {
  const match = /^(cnt_[0-9A-Za-z]{1,40})\.([0-9a-z]{1,12})\.([\w-]{43})$/.exec(token)
  if (!match?.[1] || !match[2] || !match[3]) {
    return null
  }
  if (parseInt(match[2], 36) * 1000 <= now.getTime()) {
    return null
  }
  return { entryId: match[1], expires: match[2], mac: match[3] }
}

/** Whether the token was made for the entry as it is saved now. */
export function previewOpens(
  key: Buffer,
  parts: PreviewTokenParts,
  savedAt: Date | string
): boolean {
  return safeEqual(parts.mac, macOf(key, parts.entryId, parts.expires, new Date(savedAt)))
}
