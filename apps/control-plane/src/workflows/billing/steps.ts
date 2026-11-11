import type { SubscriptionStatus, TenantStatus } from "@qticaret/types/control-plane"
import { billingTarget } from "../../lib/billing/tenant-moves"
import type { PackageTerms } from "../../modules/billing/types"
import { billingIn, plansIn, tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

type Container = Parameters<typeof billingIn>[0]

const STATUS_TRANSITION = "cp.status_transition"

/** The package a shop's next period is priced from, as the plans module has it now. */
export async function termsOf(
  container: Container,
  tenantId: string
): Promise<PackageTerms | null> {
  const plan = await plansIn(container).planOf(tenantId)
  return plan
    ? {
        id: plan.id,
        price: plan.price,
        period: plan.period,
        trial_days: plan.trial_days,
        grace_days: plan.grace_days,
      }
    : null
}

export interface TenantBillingMove {
  moved: boolean
  from: TenantStatus
  to: TenantStatus
}

interface MoveUndo {
  tenant_id: string
  from: TenantStatus
  to: TenantStatus
  change_id: string
}

/**
 * The shop's status after its subscription's (adr/0061 §2, Ek C16): an
 * active shop whose charge is past its grace becomes `restricted`
 * (`payment_overdue`, by the system); a restricted shop with nothing
 * overdue left is `active` again (`payment_settled`, by whoever settled
 * it). A suspended shop is left to staff (its resume follows the payments).
 * A move made meanwhile by someone else wins: this one is skipped.
 */
export const tenantBillingStatusStep = undoableStep(
  "cp-billing-tenant-status",
  async (
    input: { tenant_id: string; status: SubscriptionStatus; actor: string },
    container
  ): Promise<{ output: TenantBillingMove; undo: MoveUndo | null }> => {
    const tenants = tenantsIn(container)
    const tenant = await tenants.tenantOf(input.tenant_id)
    const target = billingTarget(tenant.status, input.status)
    const still = { output: { moved: false, from: tenant.status, to: tenant.status }, undo: null }
    if (!target) {
      return still
    }
    try {
      const moved = await tenants.changeStatus(input.tenant_id, target, {
        reason_code: target === "restricted" ? "payment_overdue" : "payment_settled",
        actor: target === "restricted" ? "system" : input.actor,
        from: [tenant.status],
      })
      return {
        output: { moved: true, from: moved.from, to: moved.to },
        undo: { tenant_id: input.tenant_id, ...moved },
      }
    } catch (error) {
      if ((error as { message?: unknown } | null)?.message === STATUS_TRANSITION) {
        return still
      }
      throw error
    }
  },
  async (undo: MoveUndo | null, container) => {
    if (undo) {
      await tenantsIn(container).undoStatusChange(undo.tenant_id, undo)
    }
  }
)

/** The subscription's state from its open charges today; undone by writing the old one back. */
export const refreshSubscriptionStep = undoableStep(
  "cp-billing-refresh",
  async (input: { subscription_id: string; today: string }, container) => {
    const status = await billingIn(container).refreshStatus(input.subscription_id, input.today)
    return { output: status.to, undo: { id: input.subscription_id, status: status.from } }
  },
  async (undo: { id: string; status: SubscriptionStatus }, container) => {
    await billingIn(container).updateSubscriptions(undo)
  }
)
