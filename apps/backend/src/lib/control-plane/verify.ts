import type { KeyObject } from "node:crypto"
import { verifyDocument } from "@qticaret/server-kit"
import { PLAN_DOCUMENT_PURPOSE, signedPlanDocumentSchema } from "@qticaret/types/control-plane"
import type { SignedPlanDocument } from "@qticaret/types/control-plane"

/**
 * Why a plan document is refused (adr/0061 §3.2, Ek C9), in the order the
 * checks run: its shape (the contract's strict schema: an unknown field,
 * an unknown version or a missing limit fails it), its signature against
 * the configured keys by `kid`, then whether it is this shop's. The serial
 * rule comes after, against what is stored (the module's service).
 */
export type PlanRefusal =
  | "control_plane.document_invalid"
  | "signature.malformed"
  | "signature.unknown_key"
  | "signature.invalid"
  | "control_plane.wrong_tenant"

export type PlanCheck = { ok: true; signed: SignedPlanDocument } | { ok: false; code: PlanRefusal }

/**
 * The receiver's checks of a pushed or pulled document; pure, so the
 * control plane's own tests can hold an issued document to them. Never
 * throws on input.
 */
export function checkPlanDocument(
  raw: unknown,
  options: { publicKeys: ReadonlyMap<string, KeyObject>; tenantId: string | null }
): PlanCheck {
  const parsed = signedPlanDocumentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, code: "control_plane.document_invalid" }
  }
  const signed = parsed.data
  const verified = verifyDocument(PLAN_DOCUMENT_PURPOSE, signed.document, signed, (kid) =>
    options.publicKeys.get(kid)
  )
  if (!verified.ok) {
    return { ok: false, code: verified.code }
  }
  // No configured id is no shop's: closed by default
  if (options.tenantId === null || signed.document.tenant_id !== options.tenantId) {
    return { ok: false, code: "control_plane.wrong_tenant" }
  }
  return { ok: true, signed }
}
