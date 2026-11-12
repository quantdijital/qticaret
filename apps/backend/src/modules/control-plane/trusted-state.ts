import { TENANT_STATUSES } from "@qticaret/types/control-plane"
import type { TenantStatus } from "@qticaret/types/control-plane"
import type { ControlPlaneConfig } from "../../lib/control-plane/config"
import { logger } from "../../lib/logging"
import { checkPlanDocument } from "../../lib/control-plane/verify"
import { DEFAULT_PLAN_STATE } from "./types"
import type { PlanState, StoredPlan } from "./types"

/**
 * What the shop trusts of its stored plan document (adr/0061 Ek C19 I2,
 * I3). The row is held to the receiver's checks again on every load
 * (signature by `kid`, this shop's id, the strict shape): a row changed in
 * the database, or signed by a key no longer configured, is not believed.
 *
 * - **stored row fails:** `control_plane.stored_invalid` (code only) and
 *   the last state this process verified, if it has one; else
 *   `restricted` (closed for the panel's writes, the storefront sells), or
 *   the row's own status when that is stricter (Ek C19 takip LOW-2: a
 *   suspended shop stays closed; a forged row only ever tightens)
 * - **no row for this `TENANT_ID` but one for another shop:**
 *   `control_plane.tenant_mismatch` and `restricted` until a valid
 *   document arrives (the database or the env belongs to another shop)
 * - **no row, but this shop has applied a document before** (its marker,
 *   `control_plane_marker`): `control_plane.document_missing` (code only)
 *   and `restricted`, or the stricter status this process last verified,
 *   until a valid document arrives (Ek C19 takip LOW-3)
 * - **no row and no marker:** `active`, as before the first document (§3.3)
 */

// How closed each status leaves the shop (lib/plan-guard `planModeOf`):
// open, restricted, suspended
const STRICTNESS: Readonly<Record<TenantStatus, number>> = {
  provisioning: 0,
  active: 0,
  restricted: 1,
  suspended: 2,
  closing: 2,
  closed: 2,
}

const isTenantStatus = (value: unknown): value is TenantStatus =>
  typeof value === "string" && (TENANT_STATUSES as readonly string[]).includes(value)

/**
 * `restricted`, or `status` when that is a known one and stricter: what a
 * row or a memory that cannot be trusted may still say only ever tightens.
 */
export function stricterThanRestricted(status: unknown): TenantStatus {
  return isTenantStatus(status) && STRICTNESS[status] > STRICTNESS.restricted
    ? status
    : "restricted"
}

export const RESTRICTED_UNTRUSTED = (status: TenantStatus = "restricted"): PlanState => ({
  ...DEFAULT_PLAN_STATE(true),
  status,
})

/** The state a verified row says. */
export function stateOfStored(stored: StoredPlan): PlanState {
  const { document } = stored
  return {
    managed: true,
    status: document.status,
    package_code: document.package_code,
    limits: { ...document.limits },
    platform_flags: { ...document.platform_flags },
    billing: { ...document.billing },
    serial: stored.serial,
    issued_at: document.issued_at,
    received_at: stored.received_at,
    confirmed_at: stored.confirmed_at,
    source: stored.source,
  }
}

/** The stored row checked as a received document is; the code when it fails. */
export function storedRowProblem(stored: StoredPlan, config: ControlPlaneConfig): string | null {
  const check = checkPlanDocument(
    { document: stored.document, kid: stored.kid, signature: stored.signature },
    config
  )
  return check.ok ? null : check.code
}

/** The status a row says, read without trusting it (a damaged row may have no document). */
export function unverifiedStatus(stored: StoredPlan): unknown {
  const document = stored.document as unknown
  return document !== null && typeof document === "object"
    ? (document as { status?: unknown }).status
    : undefined
}

/** One process's last verified state, per shop id. */
export class LastVerified {
  private held: { tenantId: string; state: PlanState } | null = null

  remember(tenantId: string, state: PlanState): PlanState {
    this.held = { tenantId, state }
    return state
  }

  private kept(tenantId: string): PlanState | null {
    return this.held?.tenantId === tenantId ? this.held.state : null
  }

  /**
   * The fallback for a row that failed its checks (logged by code): the
   * last verified state, else `restricted`, or the failed row's own status
   * when that is stricter.
   */
  fallback(tenantId: string, code: string, rowStatus?: unknown): PlanState {
    const kept = this.kept(tenantId)
    logger.error({ event: "control_plane.stored_invalid", code, kept: kept !== null })
    return kept ?? RESTRICTED_UNTRUSTED(stricterThanRestricted(rowStatus))
  }

  /** No row though this shop has applied a document: restricted, or stricter as last verified. */
  missing(tenantId: string): PlanState {
    const kept = this.kept(tenantId)
    logger.error({ event: "control_plane.document_missing", kept: kept !== null })
    return RESTRICTED_UNTRUSTED(stricterThanRestricted(kept?.status))
  }
}

/** A row for another shop and none for this one: logged, restricted. */
export function tenantMismatch(): PlanState {
  logger.error({ event: "control_plane.tenant_mismatch" })
  return RESTRICTED_UNTRUSTED()
}
