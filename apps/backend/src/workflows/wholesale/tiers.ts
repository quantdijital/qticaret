import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  createCustomerGroupsWorkflow,
  deleteCustomerGroupsWorkflow,
  deletePriceListsWorkflow,
  updateCustomerGroupsWorkflow,
  updatePriceListsWorkflow,
} from "@medusajs/medusa/core-flows"
import { createWholesaleListStep } from "./steps/create-list"
import {
  checkTierNameStep,
  createTierRowStep,
  deleteTierRowStep,
  updateTierRowStep,
} from "./steps/tier-rows"
import type { TierUpdate } from "./steps/tier-rows"

/** Marks the Medusa records the module owns, for a reader of them (adr/0037 §6's way). */
const MANAGED = { managed_by: "wholesale" }

export interface CreateTierInput {
  name: string
  rate_bps: number | null
  min_quantity: number | null
  created_by: string | null
}

/**
 * A new wholesale level (ADR-0068 §1, Ek 2026-11-15): its own customer
 * group, an `override` price list for that group (no row yet), then its
 * record. Each part is undone if a later one fails. A rate's rows are
 * written by the sync job, which the route queues.
 */
export const createTierWorkflow = createWorkflow(
  "wholesale-create-tier",
  (input: CreateTierInput) => {
    checkTierNameStep({ name: input.name })
    const groups = createCustomerGroupsWorkflow.runAsStep({
      input: transform({ input }, ({ input: { name, created_by } }) => ({
        customersData: [{ name, metadata: MANAGED, ...(created_by ? { created_by } : {}) }],
      })),
    })
    const groupId = transform({ groups }, ({ groups }) => groups[0]?.id ?? "")
    const list = createWholesaleListStep(
      transform({ input, groupId }, ({ input: { name }, groupId }) => ({
        title: name,
        customer_group_id: groupId,
      }))
    )
    const tier = createTierRowStep(
      transform({ input, groupId, list }, ({ input, groupId, list }) => ({
        name: input.name,
        customer_group_id: groupId,
        price_list_id: list.id,
        rate_bps: input.rate_bps,
        min_quantity: input.min_quantity,
        created_by: input.created_by,
      }))
    )
    return new WorkflowResponse(tier)
  }
)

/**
 * A level renamed (its group and list follow), given another rate (the
 * sync job writes it again) or another fewest units.
 */
export const updateTierWorkflow = createWorkflow("wholesale-update-tier", (input: TierUpdate) => {
  when({ input }, ({ input }) => input.name !== undefined).then(() => {
    checkTierNameStep(
      transform({ input }, ({ input }) => ({ name: input.name ?? "", except: input.id }))
    )
  })
  const updated = updateTierRowStep(input)
  when({ updated }, ({ updated }) => updated.name_changed).then(() => {
    updateCustomerGroupsWorkflow.runAsStep({
      input: transform({ updated }, ({ updated: { tier } }) => ({
        selector: { id: tier.customer_group_id },
        update: { name: tier.name },
      })),
    })
    updatePriceListsWorkflow.runAsStep({
      input: transform({ updated }, ({ updated: { tier } }) => ({
        price_lists_data: [{ id: tier.price_list_id, title: tier.name }],
      })),
    })
  })
  return new WorkflowResponse(updated)
})

/**
 * A level taken away (none of its wholesalers left): its record and
 * hand-entered prices, then its price list and group.
 */
export const deleteTierWorkflow = createWorkflow(
  "wholesale-delete-tier",
  (input: { id: string }) => {
    const removed = deleteTierRowStep(input)
    deletePriceListsWorkflow.runAsStep({
      input: transform({ removed }, ({ removed }) => ({ ids: [removed.price_list_id] })),
    })
    deleteCustomerGroupsWorkflow.runAsStep({
      input: transform({ removed }, ({ removed }) => ({ ids: [removed.customer_group_id] })),
    })
    return new WorkflowResponse({ id: input.id })
  }
)
