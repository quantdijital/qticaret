/** What a member's row says about the grant their 2FA setup would make. */
export interface GrantRow {
  role: string
  bootstrap: boolean
  assigned_by: string | null
  enrol_by: Date | string | null
  enrol_token_hash: string | null
}

/**
 * Whether confirming the member's first factor may grant their role
 * (adr/0061 §3.5, 2026-11-12). An owner from an owner's invitation
 * (pending, never enrolled: no reset token; not a bootstrap one) is granted
 * only while whoever gave the role is still a granted, active owner, as on
 * acceptance. A bootstrap owner keeps its own rule (`cp.owner_exists`);
 * every other role, a granted member and a reset's re-enrolment (an
 * owner's own act) are not held to it.
 */
export function grantHolds(row: GrantRow | undefined, grantedOwners: readonly string[]): boolean {
  if (
    row?.role !== "owner" ||
    row.bootstrap ||
    row.enrol_by === null ||
    row.enrol_token_hash !== null
  ) {
    return true
  }
  return row.assigned_by !== null && grantedOwners.includes(row.assigned_by)
}

/** The refusal when it may not: the verify route's own, no detail. */
export const GRANT_REFUSED = "cp.enrolment_token_invalid"
