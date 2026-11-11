import type { TenantStatus } from "@qticaret/types/control-plane"
import { matches } from "../staff/permissions"
import type { RequestFacts } from "../staff/permission-rules"
import { PLAN_CLOSED, PLAN_OPEN } from "./rules"

/** The key a write closed by the shop's status answers with (adr/0061 §5.5). */
export const PLAN_RESTRICTED_MESSAGE = "plan.restricted"

/** The key the storefront's checkout answers with while the shop is suspended. */
export const PLAN_SUSPENDED_MESSAGE = "plan.suspended"

/**
 * What the shop's status does to it (adr/0061 §5.5, Ek C15):
 * - `open`: as today (`provisioning`, `active`);
 * - `restricted`: the panel reads, the allow-list writes; the storefront sells;
 * - `suspended`: the panel as restricted; the storefront answers 503.
 * `closing` and `closed` (F16.11) are at least as closed as `suspended`.
 */
export type PlanMode = "open" | "restricted" | "suspended"

export function planModeOf(status: TenantStatus): PlanMode {
  switch (status) {
    case "restricted":
      return "restricted"
    case "suspended":
    case "closing":
    case "closed":
      return "suspended"
    case "provisioning":
    case "active":
      return "open"
  }
}

/** The status the panel and its refusals name: what a staff member is told. */
export type PlanStatusShown = "active" | "restricted" | "suspended"

export const shownStatusOf = (mode: PlanMode): PlanStatusShown =>
  mode === "open" ? "active" : mode

const READS = new Set(["GET", "HEAD", "OPTIONS"])

export interface PlanWriteDecision {
  allowed: boolean
  /** Why, for the log: a read, the allow-list, a closed area, or no rule at all. */
  reason: "read" | "open" | "closed" | "unlisted"
}

/**
 * Whether a restricted or suspended shop may make this admin request.
 * `path` is the path Express routes (lower-cased, no query, no trailing
 * slash). The allow-list is matched on that raw form only, as the role
 * table's allow-lists are: an encoded path matches nothing and stays closed.
 */
export function decidePlanWrite(
  method: string,
  path: string,
  facts: RequestFacts = {}
): PlanWriteDecision {
  const verb = method.toUpperCase()
  if (READS.has(verb)) {
    return { allowed: true, reason: "read" }
  }
  if (matches(PLAN_OPEN, verb, path, facts)) {
    return { allowed: true, reason: "open" }
  }
  return matches(PLAN_CLOSED, verb, path, facts)
    ? { allowed: false, reason: "closed" }
    : { allowed: false, reason: "unlisted" }
}
