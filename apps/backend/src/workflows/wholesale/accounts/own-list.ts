import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { createCustomerGroupsWorkflow } from "@medusajs/medusa/core-flows"
import { createWholesaleListStep } from "../steps/create-list"
import { patchAccountStep } from "../steps/account-rows"

/** Marks the Medusa records the module owns, as the levels' are. */
const MANAGED = { managed_by: "wholesale" }

/**
 * A wholesaler's own prices (ADR-0068 §1, Ek 2026-11-15): a hidden group
 * of one, an `override` list for it (its rows carry the group as a price
 * rule, written by the sync), both named by the account's id (no one's
 * name in them), then the account pointed at them. The customer joins
 * the group through the account's memberships. Each part is undone if a
 * later one fails.
 */
export const openOwnListWorkflow = createWorkflow(
  "wholesale-open-own-list",
  (input: { account_id: string }) => {
    const title = transform({ input }, ({ input }) => `Toptancı ${input.account_id}`)
    const groups = createCustomerGroupsWorkflow.runAsStep({
      input: transform({ title }, ({ title }) => ({
        customersData: [{ name: title, metadata: MANAGED }],
      })),
    })
    const groupId = transform({ groups }, ({ groups }) => groups[0]?.id ?? "")
    const list = createWholesaleListStep(
      transform({ title, groupId }, ({ title, groupId }) => ({
        title,
        customer_group_id: groupId,
      }))
    )
    patchAccountStep(
      transform({ input, groupId, list }, ({ input, groupId, list }) => ({
        id: input.account_id,
        patch: { private_group_id: groupId, private_price_list_id: list.id },
      }))
    ).config({ name: "wholesale-point-own-list" })
    return new WorkflowResponse({ group_id: groupId, price_list_id: list.id })
  }
)
