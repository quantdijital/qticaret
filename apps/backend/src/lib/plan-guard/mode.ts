import type { MedusaContainer } from "@medusajs/framework/types"
import { planStateOf } from "../plan-limits/check"
import { planModeOf } from "./decide"
import type { PlanMode } from "./decide"

/**
 * The shop's mode from its last signed plan document (C9's `planState()`,
 * cached, every process within a second). Unmanaged (no control plane
 * keys: development, tests) it is always `open`: the guard never blocks.
 */
export async function planModeFor(container: Pick<MedusaContainer, "resolve">): Promise<PlanMode> {
  const state = await planStateOf(container)
  return state.managed ? planModeOf(state.status) : "open"
}
