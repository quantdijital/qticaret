import type { TenantStatus } from "@qticaret/types/control-plane"

/**
 * The lifecycle moves staff make by hand (adr/0061 §2, Ek C15): a
 * suspension and its end. `restricted` is the billing job's (C16), the
 * closing is later (F16.11); neither is here.
 */
export const MANUAL_STATUS_MOVES = ["suspend", "resume"] as const
export type ManualStatusMove = (typeof MANUAL_STATUS_MOVES)[number]

/** The status row's reason code for each move. */
export const MOVE_REASON_CODES: Readonly<Record<ManualStatusMove, string>> = {
  suspend: "staff_suspend",
  resume: "staff_resume",
}

/** Where a move may start; anything else is 409 `cp.status_transition`. */
export const MOVE_STARTS: Readonly<Record<ManualStatusMove, readonly TenantStatus[]>> = {
  suspend: ["active", "restricted"],
  resume: ["suspended"],
}

/**
 * Where a suspension ends (§2: "ödeme durumuna göre", Ek C16): by the
 * shop's payments today, not by where it stood before. Any open charge
 * past its grace: `restricted`; else `active`.
 */
export const resumeTarget = (overdue: boolean): "active" | "restricted" =>
  overdue ? "restricted" : "active"

/** The move's target from where the shop stands now and whether a charge is past its grace. */
export function moveTarget(
  move: ManualStatusMove,
  current: TenantStatus,
  overdue: boolean
): TenantStatus | null {
  if (!MOVE_STARTS[move].includes(current)) {
    return null
  }
  return move === "suspend" ? "suspended" : resumeTarget(overdue)
}
