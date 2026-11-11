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
 * Where a suspension ends (§2: "ödeme durumuna göre"). Until C16 keeps the
 * payments, the shop goes back to where it stood when it was suspended: a
 * shop restricted for an unpaid subscription stays restricted, any other
 * becomes active. C16's billing job then moves it as its payments say.
 */
export const resumeTarget = (before: TenantStatus | null): "active" | "restricted" =>
  before === "restricted" ? "restricted" : "active"

/** The move's target from where the shop stands now and stood before its suspension. */
export function moveTarget(
  move: ManualStatusMove,
  current: TenantStatus,
  beforeSuspension: TenantStatus | null
): TenantStatus | null {
  if (!MOVE_STARTS[move].includes(current)) {
    return null
  }
  return move === "suspend" ? "suspended" : resumeTarget(beforeSuspension)
}
