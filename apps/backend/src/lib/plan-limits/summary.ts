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

/** The billing summary the panel shows: the document's, without the name and instruction lifted out. */
export type BillingStanding = Omit<PlanBillingSummary, "package_name" | "payment_instruction">

/**
 * Settings > Abonelik's reading (adr/0061 §5.6, Ek C14, C16): the package
 * and its name, each limit with its use, the billing summary and the
 * payment instruction, both as the signed plan document says them.
 * Unmanaged, `managed` is false and every limit is open: the shop has no
 * plan.
 */
export interface PlanSummary {
  managed: boolean
  status: TenantStatus
  package_code: string | null
  /** The package's name as the control plane writes it (Ek C16); null from an older document. */
  package_name: string | null
  /** The Turkish month the monthly limits count (`YYYY-MM`). */
  period: string
  warning_ratio: number
  limits: LimitStanding[]
  billing: BillingStanding | null
  /**
   * How to pay, as the control plane signs it into the plan document (Ek
   * C16); null when it has none. An account number shown here comes signed,
   * never from this shop's own settings or env.
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
  const { package_name = null, payment_instruction = null, ...billing } = state.billing ?? {}
  return {
    managed: state.managed,
    status: state.status,
    package_code: state.package_code,
    package_name,
    period: turkishMonth(now),
    warning_ratio: LIMIT_WARNING_RATIO,
    limits,
    billing: state.billing ? (billing as BillingStanding) : null,
    payment_instruction,
  }
}
