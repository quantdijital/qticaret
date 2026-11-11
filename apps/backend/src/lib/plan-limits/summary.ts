import type { MedusaContainer } from "@medusajs/framework/types"
import { LIMIT_KEYS, LIMIT_REGISTRY, LIMIT_WARNING_RATIO } from "@qticaret/types/control-plane"
import type {
  LimitEnforcement,
  LimitKey,
  PlanBillingSummary,
  TenantStatus,
} from "@qticaret/types/control-plane"
import { turkishMonth } from "../control-plane/usage"
import { planStateOf } from "./check"
import { cachedUsage } from "./usage"

export interface LimitStanding {
  key: LimitKey
  /** `block` refuses the write past it, `warn` never does (orders), `later` is not applied yet. */
  kind: LimitEnforcement
  unit: "count" | "mb"
  monthly: boolean
  /** What the shop uses now; null where it keeps no count (custom domains, F16.7). */
  used: number | null
  /** What the package allows; null for no limit. */
  max: number | null
  /** Team seats: the open invitations counted in `used`. */
  pending?: number
}

/**
 * Settings > Abonelik's reading (adr/0061 §5.6, Ek C14): the package, each
 * limit with its use, the billing summary as the signed plan document says
 * it (neutral until C16) and the payment instruction. Unmanaged, `managed`
 * is false and every limit is open: the shop has no plan.
 */
export interface PlanSummary {
  managed: boolean
  status: TenantStatus
  package_code: string | null
  /** The Turkish month the monthly limits count (`YYYY-MM`). */
  period: string
  warning_ratio: number
  limits: LimitStanding[]
  billing: PlanBillingSummary | null
  /**
   * How to pay, as the control plane will sign it into the plan document
   * (C16). Null until then: an account number shown here must come signed,
   * never from this shop's own settings.
   */
  payment_instruction: string | null
}

export async function readPlanSummary(
  container: Pick<MedusaContainer, "resolve">,
  now = new Date()
): Promise<PlanSummary> {
  const state = await planStateOf(container)
  const limits = await Promise.all(
    LIMIT_KEYS.map(async (key): Promise<LimitStanding> => {
      const { enforcement, unit, monthly } = LIMIT_REGISTRY[key]
      const usage = await cachedUsage(container, key, now)
      return {
        key,
        kind: enforcement,
        unit,
        monthly,
        used: usage.used,
        max: state.managed ? state.limits[key] : null,
        ...(usage.pending === undefined ? {} : { pending: usage.pending }),
      }
    })
  )
  return {
    managed: state.managed,
    status: state.status,
    package_code: state.package_code,
    period: turkishMonth(now),
    warning_ratio: LIMIT_WARNING_RATIO,
    limits,
    billing: state.billing,
    payment_instruction: null,
  }
}
