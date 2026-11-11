import type { MedusaContainer } from "@medusajs/framework/types"
import { billingIn } from "../../workflows/modules"
import { istanbulDay } from "./days"
import { anyOverdue, graceOf } from "./rules"

/**
 * Whether a shop has an open charge past its grace on `now`'s Istanbul day
 * (Ek C16): where a suspension ends. A shop without a subscription owes
 * nothing.
 */
export async function overdueToday(
  container: Pick<MedusaContainer, "resolve">,
  tenantId: string,
  now: Date
): Promise<boolean> {
  const billing = billingIn(container)
  const sub = await billing.subscriptionOf(tenantId)
  if (!sub) {
    return false
  }
  const charges = await billing.chargesOf({ subscription_id: sub.id })
  return anyOverdue(charges, graceOf(sub), istanbulDay(now))
}
