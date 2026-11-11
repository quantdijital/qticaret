import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { LimitKey } from "@qticaret/types/control-plane"

/** The key every plan limit refusal answers with (adr/0061 §5.3). */
export const PLAN_LIMIT_MESSAGE = "plan.limit_reached"

export interface PlanLimitErrorShape {
  readonly qtErrorKind: "plan_limit"
  readonly safeMessage: string
  /** Which of the plan's limits (`products`, `staff`, …). */
  readonly limit: LimitKey
  /** What the shop uses now, before the refused write. */
  readonly used: number
  /** What its package allows. */
  readonly max: number
}

/**
 * A write past one of the package's blocking limits (adr/0061 §5.3, Ek
 * C14): a new product, a team member, stored megabytes or a content draft.
 * It answers 403 `plan.limit_reached` with `{ limit, used, max }`; nothing
 * the shop already has is touched. Like the other platform errors it
 * travels through a workflow run as a plain object, so the guard checks
 * its shape, never `instanceof`.
 */
export class PlanLimitError extends Error implements PlanLimitErrorShape {
  override readonly name = "PlanLimitError"
  readonly qtErrorKind = "plan_limit"
  readonly safeMessage = PLAN_LIMIT_MESSAGE
  readonly limit: LimitKey
  readonly used: number
  readonly max: number

  constructor(limit: LimitKey, used: number, max: number) {
    super(`plan limit reached: ${limit} ${String(used)}/${String(max)}`)
    this.limit = limit
    this.used = used
    this.max = max
  }
}

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0

export function isPlanLimitError(value: unknown): value is PlanLimitErrorShape {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const fields = value as Record<string, unknown>
  return (
    fields["qtErrorKind"] === "plan_limit" &&
    fields["safeMessage"] === PLAN_LIMIT_MESSAGE &&
    (LIMIT_KEYS as readonly unknown[]).includes(fields["limit"]) &&
    isCount(fields["used"]) &&
    isCount(fields["max"])
  )
}
