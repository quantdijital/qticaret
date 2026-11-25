import type { MedusaContainer } from "@medusajs/framework/types"
import { plansIn } from "../../workflows/modules"
import { effectiveFlags } from "../fleet/plan-content"

type Container = Pick<MedusaContainer, "resolve">

/** The plan flag that opens the platform's AI credits to a shop (adr/0085 §2). */
export const PLATFORM_CREDITS_FLAG = "ai.platform_credits"

/**
 * The shop's `ai.platform_credits` as its plan document says it, whatever
 * its status: its own exception while it holds, else its package's, else
 * the list's default (off). A shop on no package has no document: off.
 * The gateway adds the status (`platformCreditsOn`); the owner's wallet
 * screen shows the two apart (P3d).
 */
export async function platformCreditsFlagOf(
  container: Container,
  tenantId: string,
  now: Date
): Promise<boolean> {
  const plans = plansIn(container)
  const [plan, overrides] = await Promise.all([
    plans.planOf(tenantId),
    plans.featureOverridesOf(tenantId),
  ])
  if (!plan) {
    return false
  }
  return (
    effectiveFlags(plan.features, overrides, now, process.env["NODE_ENV"]).find(
      (flag) => flag.key === PLATFORM_CREDITS_FLAG
    )?.value === true
  )
}
