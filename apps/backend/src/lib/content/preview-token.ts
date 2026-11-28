import { createHmac } from "node:crypto"
import { safeEqual } from "@qticaret/server-kit"

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

export interface PreviewTokenParts {
  entryId: string
  expires: string
  mac: string
}

/**
 * Signed preview links for one kind of record: `<id>.<end, base 36
 * seconds>.<mac>`, the MAC under the kind's own context, so a link made for
 * one kind never opens another. Shared by content entries and the
 * storefront's design (adr/0049), and the maintenance bypass (adr/0053),
 * whose links last `hours` and are bound to a version number rather than a
 * time: a record's "saved" mark is either.
 */
export function previewSigner(context: string, idPattern: string, hours = PREVIEW_HOURS) {
  const macOf = (key: Buffer, entryId: string, expires: string, savedAt: Date): string =>
    createHmac("sha256", key)
      .update(`${context}:${entryId}:${expires}:${String(savedAt.getTime())}`, "utf8")
      .digest("base64url")
  const shape = new RegExp(`^(${idPattern})\\.([0-9a-z]{1,12})\\.([\\w-]{43})$`)
  return {
    token: (
      key: Buffer,
      entry: { id: string; updated_at: Date | string | number },
      now = new Date()
    ): { token: string; expires_at: Date } => {
      const end = Math.floor((now.getTime() + hours * HOUR_MS) / 1000)
      const expires = end.toString(36)
      return {
        token: `${entry.id}.${expires}.${macOf(key, entry.id, expires, new Date(entry.updated_at))}`,
        expires_at: new Date(end * 1000),
      }
    },
    /** The token's parts while it is well formed and before its end; null otherwise. */
    parts: (token: string, now = new Date()): PreviewTokenParts | null => {
      const match = shape.exec(token)
      if (!match?.[1] || !match[2] || !match[3]) {
        return null
      }
      if (parseInt(match[2], 36) * 1000 <= now.getTime()) {
        return null
      }
      return { entryId: match[1], expires: match[2], mac: match[3] }
    },
    /** Whether the token was made for the record as it is saved now. */
    opens: (key: Buffer, parts: PreviewTokenParts, savedAt: Date | string | number): boolean => {
      return safeEqual(parts.mac, macOf(key, parts.entryId, parts.expires, new Date(savedAt)))
    },
  }
}

const contentPreview = previewSigner("content-preview:v2", "cnt_[0-9A-Za-z]{1,40}")

/** `<entry id>.<end, base 36 seconds>.<mac>`. */
export const previewToken = contentPreview.token

/** The token's parts while it is well formed and before its end; null otherwise. */
export const previewTokenParts = contentPreview.parts

/** Whether the token was made for the entry as it is saved now. */
export const previewOpens = contentPreview.opens

/** The storefront's design as last saved (adr/0049): its own context, `sfl_` ids. */
export const layoutPreview = previewSigner("layout-preview:v1", "sfl_[0-9A-Za-z]{1,40}")

/** How long a saved look's preview link lasts: the gallery asks again before it ends. */
export const DESIGN_PREVIEW_HOURS = 1

/**
 * A saved look drawn on the storefront (adr/0064, as Shopify's
 * `preview_theme_id`): its own context, `sfd_` ids, an hour, ended by a
 * rename (its save mark moves) or its removal. Opens that look only.
 */
export const designPreview = previewSigner(
  "design-preview:v1",
  "sfd_[0-9A-Za-z]{1,40}",
  DESIGN_PREVIEW_HOURS
)

/**
 * A draft product's page as last saved (F18): its own context, `prod_` ids;
 * a later save of the product ends the link, as with content entries.
 */
export const productPreview = previewSigner("product-preview:v1", "prod_[0-9A-Za-z]{1,40}")
