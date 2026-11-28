import type { KeyObject } from "node:crypto"
import { verifyDocument } from "@qticaret/server-kit"
import {
  SUPPORT_GRANT_MAX_CHARS,
  SUPPORT_GRANT_MAX_SKEW_SECONDS,
  SUPPORT_GRANT_PURPOSE,
  SUPPORT_GRANT_REDEEM_SECONDS,
  signedSupportGrantSchema,
} from "@qticaret/types/control-plane"
import type { SupportGrantDocument } from "@qticaret/types/control-plane"

/**
 * The shop's checks of a support grant (adr/0061 Ek "Destek erişimi",
 * Karar 3), pure and in order: its shape, the control plane's signature by
 * `kid`, that it is for this shop's panel, then its times. Single use is
 * the store's (`store.ts`), after these pass; the owner's switch, the
 * route's. Never throws on input.
 */
export type GrantRefusal =
  | "support.grant_invalid"
  | "signature.malformed"
  | "signature.unknown_key"
  | "signature.invalid"
  | "support.wrong_tenant"
  | "support.grant_expired"

export type GrantCheck =
  { ok: true; grant: SupportGrantDocument } | { ok: false; code: GrantRefusal }

const BASE64URL = /^[A-Za-z0-9_-]+$/

/** The link's `grant` value back to its JSON; null for anything that is not one. */
export function decodeGrant(encoded: unknown): unknown {
  if (
    typeof encoded !== "string" ||
    encoded.length > SUPPORT_GRANT_MAX_CHARS ||
    !BASE64URL.test(encoded)
  ) {
    return null
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown
  } catch {
    return null
  }
}

export function checkSupportGrant(
  encoded: unknown,
  options: {
    publicKeys: ReadonlyMap<string, KeyObject>
    tenantId: string | null
    /** Unix seconds. */
    now: number
  }
): GrantCheck {
  const parsed = signedSupportGrantSchema.safeParse(decodeGrant(encoded))
  if (!parsed.success) {
    return { ok: false, code: "support.grant_invalid" }
  }
  const signed = parsed.data
  const verified = verifyDocument(SUPPORT_GRANT_PURPOSE, signed.document, signed, (kid) =>
    options.publicKeys.get(kid)
  )
  if (!verified.ok) {
    return { ok: false, code: verified.code }
  }
  const grant = signed.document
  // The audience is held by the schema (`shop_panel` only); no configured id is no shop's
  if (options.tenantId === null || grant.tenant_id !== options.tenantId) {
    return { ok: false, code: "support.wrong_tenant" }
  }
  const { now } = options
  const fromTheFuture = grant.issued_at > now + SUPPORT_GRANT_MAX_SKEW_SECONDS
  const redeemedLate = now > grant.issued_at + SUPPORT_GRANT_REDEEM_SECONDS
  if (fromTheFuture || redeemedLate || now >= grant.expires_at) {
    return { ok: false, code: "support.grant_expired" }
  }
  return { ok: true, grant }
}
