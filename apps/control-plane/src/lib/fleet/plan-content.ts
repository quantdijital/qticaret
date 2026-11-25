import { createHash } from "node:crypto"
import { canonicalJsonDeep } from "@qticaret/server-kit"
import {
  PLAN_DOCUMENT_VERSION,
  isGrantLimit,
  planDocumentSchema,
  platformFlags,
} from "@qticaret/types/control-plane"
import type {
  LimitKey,
  PlanBillingSummary,
  PlanDocument,
  PlanLimits,
  TenantStatus,
} from "@qticaret/types/control-plane"
import { effectiveLimits } from "../plans/limits"
import type { LimitValue, LimitValues, OverrideLike } from "../plans/limits"

/**
 * A shop's plan document before its serial and time (adr/0061 §3.2, Ek
 * C9): what the control plane says the shop may do. Its hash decides
 * whether a new document is issued: the same content issues nothing.
 */
export type PlanContent = Omit<PlanDocument, "serial" | "issued_at">

/**
 * A document's billing before a shop has a subscription (Ek C9, C16):
 * "active, nothing due"; the shop shows no payment strip, and no status
 * follows from it. With one, the summary is billing's (lib/billing/summary.ts).
 */
export const NEUTRAL_BILLING: PlanBillingSummary = Object.freeze({
  status: "active",
  due_on: null,
  grace_ends_on: null,
  amount: null,
  currency: "TRY",
})

export interface FlagOverrideLike {
  key: string
  enabled: boolean
  expires_at: Date | string | null
}

export interface EffectiveFlag {
  key: string
  /** The shared list's default: what a package without a value gets. */
  default: boolean
  /** The package's value; undefined when it sets none (or there is no package). */
  package: boolean | undefined
  /** The shop's own value while its exception holds. */
  override: boolean | undefined
  value: boolean
}

const holds = (override: { expires_at: Date | string | null }, now: Date) =>
  override.expires_at === null || new Date(override.expires_at).getTime() > now.getTime()

/**
 * Every platform flag in force (the shared list under `nodeEnv`): the
 * shop's exception while it holds, else the package's value, else the
 * list's default. A key the list does not have (a flag since removed) is
 * left out.
 */
export function effectiveFlags(
  packageFeatures: Readonly<Record<string, boolean>> | null,
  overrides: readonly FlagOverrideLike[],
  now: Date,
  nodeEnv: string | undefined
): EffectiveFlag[] {
  return platformFlags(nodeEnv).map((flag) => {
    const own = overrides.find((each) => each.key === flag.key && holds(each, now))
    const fromPackage =
      packageFeatures && Object.hasOwn(packageFeatures, flag.key)
        ? packageFeatures[flag.key]
        : undefined
    return {
      key: flag.key,
      default: flag.default,
      package: fromPackage,
      override: own?.enabled,
      value: own ? own.enabled : (fromPackage ?? flag.default),
    }
  })
}

export interface PlanContentInput {
  tenantId: string
  status: TenantStatus
  packageCode: string
  packageLimits: LimitValues
  packageFeatures: Readonly<Record<string, boolean>>
  limitOverrides: readonly OverrideLike[]
  flagOverrides: readonly FlagOverrideLike[]
  /** The billing summary (Ek C16); the neutral one when not given. */
  billing?: PlanBillingSummary | undefined
  now: Date
  nodeEnv: string | undefined
}

/** The document's content for a shop on a package: its status, limits, flags and billing. */
export function planContent(input: PlanContentInput): PlanContent {
  // A grant of 0 is left out (absent is 0, adr/0085 K5): a shop's document
  // does not change, nor does a shop not yet knowing the key refuse it
  const limits = Object.fromEntries(
    effectiveLimits(input.packageLimits, input.limitOverrides, input.now).flatMap(
      (each): [LimitKey, LimitValue][] =>
        isGrantLimit(each.key) && (each.value === null || each.value <= 0)
          ? []
          : [[each.key, each.value]]
    )
  ) as PlanLimits
  const flags = effectiveFlags(input.packageFeatures, input.flagOverrides, input.now, input.nodeEnv)
  return {
    version: PLAN_DOCUMENT_VERSION,
    tenant_id: input.tenantId,
    status: input.status,
    package_code: input.packageCode,
    limits,
    platform_flags: Object.fromEntries(flags.map((flag) => [flag.key, flag.value])),
    billing: { ...(input.billing ?? NEUTRAL_BILLING) },
  }
}

/** SHA-256 of the content's canonical JSON: the same content, the same hash. */
export const contentHash = (content: PlanContent): string =>
  createHash("sha256").update(canonicalJsonDeep(content)).digest("hex")

/**
 * The document itself, with its serial and time, held to the contract's
 * strict schema before anything signs it: a document the shop would refuse
 * is never issued.
 */
export function planDocumentOf(content: PlanContent, serial: number, issuedAt: Date): PlanDocument {
  return planDocumentSchema.parse({ ...content, serial, issued_at: issuedAt.toISOString() })
}
