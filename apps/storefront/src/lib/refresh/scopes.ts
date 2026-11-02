import "server-only"
import { forget as forgetEdgeSite } from "../store-api/edge"
import { forgetShared } from "../store-api/shared"
import { refreshPlan } from "./contract"
import type { RefreshScope } from "./contract"

/** Drops the shared answers and the edge's site facts the scopes touched (adr/0048 Ek 2026-11-03). */
export function forgetScopes(scopes: readonly RefreshScope[]): void {
  const plan = refreshPlan(scopes)
  forgetShared(plan.paths)
  if (plan.edgeSite) {
    forgetEdgeSite()
  }
}
