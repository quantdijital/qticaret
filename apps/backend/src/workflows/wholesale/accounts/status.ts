import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { checkAccountStep, patchAccountStep } from "../steps/account-rows"
import { repriceCartsStep } from "../steps/carts"
import { syncMembershipsStep } from "../steps/memberships"

interface StatusInput {
  id: string
  updated_by: string | null
}

const lockOf = (input: StatusInput) => `wholesale-account:${input.id}`

/**
 * A wholesaler closed (ADR-0068 §3): out of its level's and its own group
 * at once, so the next request pays retail, and every open cart of theirs
 * priced again; how many were, and how many could not be, is in the
 * result (review M1). The level, the own list and its prices stay for a
 * reopening. No message goes. A restricted or suspended shop may still do
 * this (adr/0061 §5.5: taking access away).
 */
export const deactivateAccountWorkflow = createWorkflow(
  "wholesale-deactivate-account",
  (input: StatusInput) => {
    const lock = transform({ input }, ({ input }) => lockOf(input))
    acquireLockStep({ key: lock, timeout: 5, ttl: 120 })
    const account = checkAccountStep(
      transform({ input }, ({ input }) => ({ id: input.id, action: "deactivate" as const }))
    )
    patchAccountStep(
      transform({ input }, ({ input }) => ({
        id: input.id,
        patch: {
          status: "inactive" as const,
          deactivated_at: new Date(),
          updated_by: input.updated_by,
        },
      }))
    )
    const moved = syncMembershipsStep(
      transform({ input }, ({ input }) => ({ account_id: input.id }))
    )
    const carts = repriceCartsStep(
      transform({ account, moved }, ({ account, moved }) => ({
        customer_id: account.customer_id,
        changed: moved.added + moved.removed > 0,
      }))
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ input, carts }, ({ input, carts }) => ({ id: input.id, carts }))
    )
  }
)

/** A closed wholesaler opened again: back in its groups, every open cart at wholesale. */
export const reactivateAccountWorkflow = createWorkflow(
  "wholesale-reactivate-account",
  (input: StatusInput) => {
    const lock = transform({ input }, ({ input }) => lockOf(input))
    acquireLockStep({ key: lock, timeout: 5, ttl: 120 })
    const account = checkAccountStep(
      transform({ input }, ({ input }) => ({ id: input.id, action: "reactivate" as const }))
    )
    patchAccountStep(
      transform({ input }, ({ input }) => ({
        id: input.id,
        patch: { status: "active" as const, deactivated_at: null, updated_by: input.updated_by },
      }))
    )
    const moved = syncMembershipsStep(
      transform({ input }, ({ input }) => ({ account_id: input.id }))
    )
    const carts = repriceCartsStep(
      transform({ account, moved }, ({ account, moved }) => ({
        customer_id: account.customer_id,
        changed: moved.added + moved.removed > 0,
      }))
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ input, carts }, ({ input, carts }) => ({ id: input.id, carts }))
    )
  }
)
