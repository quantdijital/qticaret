import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  deleteCustomerGroupsWorkflow,
  deletePriceListsWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../../lib/logging"
import { inviteCutoff } from "../../../lib/wholesale"
import { checkAccountStep, removeAccountRowStep, wholesale } from "../steps/account-rows"

/** The own list's hand-entered prices taken away with it; undone by bringing them back. */
const removeMarksStep = createStep(
  "wholesale-remove-own-marks",
  async (input: { price_list_id: string | null }, { container }) => {
    if (!input.price_list_id) {
      return new StepResponse(0, [] as string[])
    }
    const service = wholesale(container)
    const marks = await service.listWholesaleManualPrices(
      { price_list_id: input.price_list_id },
      { select: ["id"], take: null }
    )
    const ids = marks.map((mark) => mark.id)
    if (ids.length > 0) {
      await service.softDeleteWholesaleManualPrices(ids)
    }
    return new StepResponse(ids.length, ids)
  },
  async (ids, { container }) => {
    if (ids && ids.length > 0) {
      await wholesale(container).restoreWholesaleManualPrices(ids)
    }
  }
)

/**
 * A pending wholesaler taken back (ADR-0068 §3: only a pending one; an
 * active one is closed) or past its 90 days (§10): its own list and group
 * and their prices, then the account, the address it held cleared.
 */
export const deletePendingAccountWorkflow = createWorkflow(
  "wholesale-delete-pending-account",
  (input: { id: string }) => {
    const lock = transform({ input }, ({ input }) => `wholesale-account:${input.id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    const account = checkAccountStep(
      transform({ input }, ({ input }) => ({ id: input.id, action: "delete" as const }))
    )
    removeMarksStep(
      transform({ account }, ({ account }) => ({ price_list_id: account.private_price_list_id }))
    )
    when(
      "wholesale-delete-own-list",
      { account },
      ({ account }) => account.private_price_list_id !== null
    ).then(() => {
      deletePriceListsWorkflow.runAsStep({
        input: transform({ account }, ({ account }) => ({
          ids: [account.private_price_list_id ?? ""],
        })),
      })
      deleteCustomerGroupsWorkflow.runAsStep({
        input: transform({ account }, ({ account }) => ({
          ids: [account.private_group_id ?? ""],
        })),
      })
    })
    removeAccountRowStep(transform({ input }, ({ input }) => ({ id: input.id })))
    releaseLockStep({ key: lock })
    return new WorkflowResponse({ id: input.id })
  }
)

/**
 * Invitations not taken up in 90 days (decision 13, ADR-0068 §10): each
 * pending account last invited 90 days ago, or opened 180 days ago
 * however often resent (review L2), removed. One that fails is
 * logged and tried again on the next run. Returns how many went.
 */
export async function removeExpiredInvitations(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<number> {
  const cutoff = inviteCutoff(now)
  const expired = await wholesale(container).listWholesaleAccounts(
    {
      status: "pending",
      $or: [
        { invited_at: { $lt: cutoff.invitedBefore } },
        { created_at: { $lt: cutoff.openedBefore } },
      ],
    },
    { select: ["id"], take: null }
  )
  let removed = 0
  for (const { id } of expired) {
    try {
      await deletePendingAccountWorkflow(container).run({ input: { id } })
      removed += 1
    } catch (error) {
      logger.warn({ event: "wholesale.invite_expiry_failed", err: errorSummary(error) })
    }
  }
  return removed
}
