import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  acquireLockStep,
  deleteCustomerGroupsWorkflow,
  deletePriceListsWorkflow,
  dismissRemoteLinkStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../../lib/logging"
import { inviteCutoff } from "../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import {
  accountById,
  checkAccountStep,
  patchAccountStep,
  retireAccountRowStep,
  wholesale,
} from "../steps/account-rows"
import { repriceAllCartsStep, repriceOnUndoStep } from "../steps/carts"
import { syncMembershipsStep } from "../steps/memberships"

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

/** The account's state before deleting, and its customer's display name for the order list. */
const readForDeleteStep = createStep(
  "wholesale-read-for-delete",
  async (input: { id: string }, { container }) => {
    const account = await accountById(container, input.id)
    const { data } = account.customer_id
      ? await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "customer",
          fields: ["company_name"],
          filters: { id: account.customer_id },
        })
      : { data: [] }
    const company = (data[0] as { company_name?: string | null } | undefined)?.company_name
    return new StepResponse({
      customer_id: account.customer_id ?? null,
      status: account.status,
      deactivated_at: account.deactivated_at ?? null,
      // The company the order list names, for a wholesaler that had orders (a bound one);
      // nothing for one never bound (review L1). A person's name is never kept (KVKK)
      company_name: account.customer_id
        ? ([company, account.company_name]
            .map((name) => name?.trim() ?? "")
            .find((name) => name !== "") ?? null)
        : null,
    })
  }
)

/**
 * A wholesaler deleted (ADR-0068 Ek 2026-11-15 (2), the owner: "bu
 * toptancıları silemiyorum"), whatever its state; also an older pending
 * one taken back or past its days. Only the wholesale side goes, each
 * step undone if a later one fails:
 * - closed first, as `deactivateAccountWorkflow` closes (its closing
 *   time written): out of its groups at once, every open cart priced
 *   again at retail; one that cannot be refuses the deletion;
 * - its own list, hidden group and hand-entered prices deleted;
 * - its link to the customer dismissed; the customer and their sign-in
 *   stay, an ordinary retail customer;
 * - the row soft-deleted with only the company name kept (none for one
 *   never bound), so its past orders stay wholesale orders and still show
 *   who placed them; the address and contact cleared. The same address
 *   may be opened again.
 */
export const deleteAccountWorkflow = createWorkflow(
  "wholesale-delete-account",
  (input: { id: string; updated_by: string | null }) => {
    const lock = transform({ input }, ({ input }) => `wholesale-account:${input.id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 120 })
    const account = checkAccountStep(
      transform({ input }, ({ input }) => ({ id: input.id, action: "delete" as const }))
    )
    // The sync job writes the own list's rows under this lock: none while it is deleted
    const listLock = transform(
      { account },
      ({ account }) => `wholesale-list:${account.private_price_list_id ?? account.id}`
    )
    acquireLockStep({ key: listLock, timeout: 30, ttl: 120 })
    const read = readForDeleteStep(transform({ input }, ({ input }) => ({ id: input.id })))
    // On an undo, after its groups are back: its carts at wholesale again (review L3)
    repriceOnUndoStep(transform({ read }, ({ read }) => ({ customer_id: read.customer_id })))
    patchAccountStep(
      transform({ input, read }, ({ input, read }) => ({
        id: input.id,
        patch: {
          status: "inactive" as const,
          // When it stopped selling at wholesale: an order stamped later decides by it (L4)
          deactivated_at:
            read.status === "inactive" && read.deactivated_at
              ? new Date(read.deactivated_at)
              : new Date(),
          updated_by: input.updated_by,
        },
      }))
    )
    const moved = syncMembershipsStep(
      transform({ input }, ({ input }) => ({ account_id: input.id }))
    )
    // Every open cart at retail, or nothing deleted (review L3)
    const carts = repriceAllCartsStep(
      transform({ account, moved }, ({ account, moved }) => ({
        customer_id: account.customer_id,
        changed: moved.added + moved.removed > 0,
      }))
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
    when("wholesale-delete-customer-link", { read }, ({ read }) => read.customer_id !== null).then(
      () => {
        dismissRemoteLinkStep(
          transform({ input, read }, ({ input, read }) => [
            {
              [Modules.CUSTOMER]: { customer_id: read.customer_id ?? "" },
              [WHOLESALE_MODULE]: { wholesale_account_id: input.id },
            },
          ])
        )
      }
    )
    retireAccountRowStep(
      transform({ input, read }, ({ input, read }) => ({
        id: input.id,
        company_name: read.company_name,
      }))
    )
    releaseLockStep({ key: listLock })
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ input, carts }, ({ input, carts }) => ({ id: input.id, carts }))
    )
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
      await deleteAccountWorkflow(container).run({ input: { id, updated_by: null } })
      removed += 1
    } catch (error) {
      logger.warn({ event: "wholesale.invite_expiry_failed", err: errorSummary(error) })
    }
  }
  return removed
}
