/**
 * Platform staff roles (adr/0061 §3.5). Fixed, one per member:
 * - `owner`: everything; the only one who manages staff, closes a shop,
 *   rotates keys and reads the audit log
 * - `operator`: opens and sets up shops, notes, packages, overrides
 * - `finance`: payments, reminders, package prices
 * - `readonly`: reads
 * What each may call is the route table's (route-table.ts), closed by
 * default.
 */
export const CP_STAFF_ROLES = ["owner", "operator", "finance", "readonly"] as const
export type CpStaffRole = (typeof CP_STAFF_ROLES)[number]

/**
 * The roles an invitation gives: every one (2026-11-12). An owner is
 * invited by a granted owner (accepted only while that owner still is
 * one), made from the team, or bootstrapped once by `cp:create-owner`.
 * Any role is granted only once the member's 2FA is set up.
 */
export const CP_INVITABLE_ROLES = ["owner", "operator", "finance", "readonly"] as const
export type CpInvitableRole = (typeof CP_INVITABLE_ROLES)[number]

export const isCpStaffRole = (value: unknown): value is CpStaffRole =>
  typeof value === "string" && (CP_STAFF_ROLES as readonly string[]).includes(value)
