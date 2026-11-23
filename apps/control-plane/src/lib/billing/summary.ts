import type { MedusaContainer } from "@medusajs/framework/types"
import type { PlanBillingSummary } from "@qticaret/types/control-plane"
import { billingIn } from "../../workflows/modules"
import { billingSummary, graceOf } from "./rules"
import { subscriptionTerms } from "./terms"

type Container = Pick<MedusaContainer, "resolve">

/** Before a shop has a subscription: nothing due, no strip (Ek C9's neutral summary). */
const NOTHING_DUE = {
  status: "active",
  due_on: null,
  grace_ends_on: null,
  amount: null,
  currency: "TRY",
} as const

/**
 * The plan document's billing summary for a shop (adr/0061 §3.2, §5.6, Ek
 * C16): its subscription's state, the oldest open charge (or the next
 * renewal at the package's price now), the package's name and the
 * platform's payment instruction, the subscription's terms (Ek C20). Read from what is stored, never from
 * the clock: the document changes only when billing does.
 */
export async function billingSummaryOf(
  container: Container,
  tenantId: string,
  plan: { name: string; price: number }
): Promise<PlanBillingSummary> {
  const billing = billingIn(container)
  const [sub, instruction] = await Promise.all([
    billing.subscriptionOf(tenantId),
    billing.paymentInstruction(),
  ])
  // Ek C20: what a period costs, how long it is, the trial
  const extra = {
    package_name: plan.name,
    payment_instruction: instruction.value ?? null,
    ...subscriptionTerms(sub),
  }
  if (!sub) {
    return { ...NOTHING_DUE, ...extra }
  }
  const charges = await billing.chargesOf({ subscription_id: sub.id })
  const open = charges.filter((charge) => charge.status === "open")
  // The next renewal: after the last period a charge was made for (paid ahead), else this one's end
  const covered = charges
    .filter((charge) => charge.status !== "void")
    .map((charge) => charge.period_end)
    .reduce((last, end) => (end > last ? end : last), sub.current_period_end)
  return {
    ...billingSummary({
      status: sub.status,
      graceDays: graceOf(sub),
      open,
      next: { due_on: covered, amount: plan.price },
    }),
    ...extra,
  }
}
