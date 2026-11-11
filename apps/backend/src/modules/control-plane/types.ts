import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type {
  PlanBillingSummary,
  PlanDocument,
  PlanLimits,
  SignedPlanDocument,
  TenantStatus,
} from "@qticaret/types/control-plane"
import type { PlanSource } from "./models/control-plane-plan"

export interface ControlPlaneModuleOptions {
  /** Shared version marker across processes; without it each process trusts its own writes. */
  redisUrl?: string
  versionKey?: string
}

export interface StoredPlan {
  tenant_id: string
  serial: number
  document: PlanDocument
  kid: string
  signature: string
  received_at: Date
  /** The last bound pull of this document or an older one; null before any. */
  confirmed_at: Date | null
  source: PlanSource
}

/**
 * What the control plane says this shop may do, as the rest of the shop
 * reads it (adr/0061 §5, Ek C9). Exposed only: limits are enforced in C14,
 * the status's effects (restricted, suspended) come in C15.
 */
export interface PlanState {
  /** False: no `CONTROL_PLANE_PUBLIC_KEYS` (development, tests): today's behaviour. */
  managed: boolean
  /** `active` until a signed document says otherwise; never from unreachability. */
  status: TenantStatus
  package_code: string | null
  /** Every registry key; null is unlimited (all null without a document). */
  limits: PlanLimits
  /** As the document carries them; the flag registry decides which apply. */
  platform_flags: Record<string, boolean>
  billing: PlanBillingSummary | null
  serial: number | null
  issued_at: string | null
  received_at: Date | null
  /** The last pull bound to the shop's own nonce (a push never moves it). */
  confirmed_at: Date | null
  source: PlanSource | null
}

export const NO_LIMITS = Object.freeze(
  Object.fromEntries(LIMIT_KEYS.map((key) => [key, null]))
) as PlanLimits

/** Unmanaged, or managed before the first document: selling as today. */
export const DEFAULT_PLAN_STATE = (managed: boolean): PlanState => ({
  managed,
  status: "active",
  package_code: null,
  limits: { ...NO_LIMITS },
  platform_flags: {},
  billing: null,
  serial: null,
  issued_at: null,
  received_at: null,
  confirmed_at: null,
  source: null,
})

/** What a document did to the stored one (`comparePlanSerial`). */
export type StoreOutcome = "applied" | "same" | "stale"

export interface StoreResult {
  outcome: StoreOutcome
  /** The row before an `applied`, to put back; null when there was none. */
  previous: StoredPlan | null
}

export type { SignedPlanDocument }
