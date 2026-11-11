import type { MedusaContainer } from "@medusajs/framework/types"
import { LIMIT_REGISTRY } from "@qticaret/types/control-plane"
import type { LimitKey } from "@qticaret/types/control-plane"
import { CONTROL_PLANE_MODULE } from "../../modules/control-plane"
import type ControlPlaneModuleService from "../../modules/control-plane/service"
import type { PlanState } from "../../modules/control-plane/service"
import { megabytesOf, storedBytes } from "../control-plane/usage"
import { PlanLimitError } from "../errors"
import { countUsage, forgetUsage } from "./usage"

type Resolver = Pick<MedusaContainer, "resolve">

/**
 * The plan limits' checks (adr/0061 §5.3, Ek C14). Only the registry's
 * `block` limits refuse a write (products, staff, storage, LLM drafts);
 * monthly orders only warn and custom domains wait for F16.7. Unmanaged
 * (no control plane), every limit is open. A check counts afresh: it is a
 * write's own decision, never a cached number. Nothing the shop already
 * has is touched: only the new thing is refused.
 */

/** What the control plane says now (cached by its module, ≤ 1 s across processes). */
export const planStateOf = (container: Resolver): Promise<PlanState> =>
  container.resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE).planState()

/** The limit a write is held to, or null: unmanaged, unlimited, or not a blocking limit. */
export async function blockingLimit(container: Resolver, key: LimitKey): Promise<number | null> {
  if (LIMIT_REGISTRY[key].enforcement !== "block") {
    return null
  }
  const state = await planStateOf(container)
  return state.managed ? state.limits[key] : null
}

/**
 * After new products were written (the `productsCreated` hook): past the
 * limit, the whole create is refused and Medusa undoes it. Counting after
 * the write closes the race two creates near the limit would have: both
 * see the total, neither slips past it.
 */
export async function assertProductsWithinLimit(
  container: Resolver,
  created: number
): Promise<void> {
  const max = await blockingLimit(container, "products")
  forgetUsage("products")
  if (max === null || created <= 0) {
    return
  }
  const { used } = await countUsage(container, "products", new Date())
  const total = used ?? 0
  if (total > max) {
    throw new PlanLimitError("products", Math.max(0, total - created), max)
  }
}

/** How many more products the package allows now; null for no limit. */
export async function productAllowance(container: Resolver): Promise<number | null> {
  const max = await blockingLimit(container, "products")
  if (max === null) {
    return null
  }
  const { used } = await countUsage(container, "products", new Date())
  return Math.max(0, max - (used ?? 0))
}

/** Before an invitation: a seat is a member or an invitation still open. */
export async function assertStaffSeat(container: Resolver, now = new Date()): Promise<void> {
  const max = await blockingLimit(container, "staff")
  if (max === null) {
    return
  }
  const { used } = await countUsage(container, "staff", now)
  if ((used ?? 0) + 1 > max) {
    throw new PlanLimitError("staff", used ?? 0, max)
  }
}

/**
 * Before files are stored: the stored masters plus the incoming bytes, as
 * whole megabytes. An unknown size (an outside address to fetch) is held
 * only to the library not being full already.
 */
export async function assertStorageFits(container: Resolver, incomingBytes: number): Promise<void> {
  const max = await blockingLimit(container, "storage_mb")
  if (max === null) {
    return
  }
  const bytes = await storedBytes(container)
  const usedMb = megabytesOf(bytes)
  const fits = incomingBytes > 0 ? megabytesOf(bytes + incomingBytes) <= max : usedMb < max
  if (!fits) {
    throw new PlanLimitError("storage_mb", usedMb, max)
  }
}

/**
 * A month's content draft budget: the platform's quota or the package's
 * credits, whichever is lower. `plan` is the package's when it is the one
 * that binds, so a refusal can say which (adr/0005, adr/0061 Ek C14).
 */
export async function draftQuotaOf(
  container: Resolver,
  platformQuota: number
): Promise<{ quota: number; plan: number | null }> {
  const max = await blockingLimit(container, "llm_credits_per_month")
  return max !== null && max < platformQuota
    ? { quota: max, plan: max }
    : { quota: platformQuota, plan: null }
}
