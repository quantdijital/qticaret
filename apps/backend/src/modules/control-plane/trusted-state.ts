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
 *   `restricted` (closed for the panel's writes, the storefront sells)
 * - **no row for this `TENANT_ID` but one for another shop:**
 *   `control_plane.tenant_mismatch` and `restricted` until a valid
 *   document arrives (the database or the env belongs to another shop)
 * - **no row at all:** `active`, as before the first document (§3.3)
 */

export const RESTRICTED_UNTRUSTED = (): PlanState => ({
  ...DEFAULT_PLAN_STATE(true),
  status: "restricted",
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

/** One process's last verified state, per shop id. */
export class LastVerified {
  private held: { tenantId: string; state: PlanState } | null = null

  remember(tenantId: string, state: PlanState): PlanState {
    this.held = { tenantId, state }
    return state
  }

  /** The fallback for a row that failed its checks (logged by code). */
  fallback(tenantId: string, code: string): PlanState {
    const kept = this.held?.tenantId === tenantId ? this.held.state : null
    logger.error({ event: "control_plane.stored_invalid", code, kept: kept !== null })
    return kept ?? RESTRICTED_UNTRUSTED()
  }
}

/** A row for another shop and none for this one: logged, restricted. */
export function tenantMismatch(): PlanState {
  logger.error({ event: "control_plane.tenant_mismatch" })
  return RESTRICTED_UNTRUSTED()
}
