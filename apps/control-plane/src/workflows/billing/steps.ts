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

/** A subscription's state written again from its charges today (a step's undo: never a stale value). */
export async function refreshFor(container: Container, tenantId: string, today: string) {
  const billing = billingIn(container)
  const sub = await billing.subscriptionOf(tenantId)
  return sub ? (await billing.refreshStatus(sub.id, today)).to : null
}

export interface TenantBillingMove {
  moved: boolean
  from: TenantStatus
  to: TenantStatus
  /** The subscription's state the decision was taken on (null: none). */
  status: SubscriptionStatus | null
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
 *
 * Review M1: the subscription's state is computed here, from its charges
 * as they are now (under the subscription's row lock), never taken from
 * an earlier step; the caller holds the shop's billing lock
 * (`withBillingLock`), so no other billing change lands between the
 * reading and the move. A move made meanwhile outside billing wins.
 */
export const tenantBillingStatusStep = undoableStep(
  "cp-billing-tenant-status",
  async (
    input: { tenant_id: string; today: string; actor: string },
    container
  ): Promise<{ output: TenantBillingMove; undo: MoveUndo | null }> => {
    const status = await refreshFor(container, input.tenant_id, input.today)
    const tenants = tenantsIn(container)
    const tenant = await tenants.tenantOf(input.tenant_id)
    const target = status ? billingTarget(tenant.status, status) : null
    const still = {
      output: { moved: false, from: tenant.status, to: tenant.status, status },
      undo: null,
    }
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
        output: { moved: true, from: moved.from, to: moved.to, status },
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
