import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { sendAccountMessageStep } from "../steps/account-message"
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
 * at once, so the next request pays retail, and its open carts priced
 * again. The level, the own list and its prices stay for a reopening. No
 * message goes. A restricted or suspended shop may still do this
 * (adr/0061 §5.5: taking access away).
 */
export const deactivateAccountWorkflow = createWorkflow(
  "wholesale-deactivate-account",
  (input: StatusInput) => {
    const lock = transform({ input }, ({ input }) => lockOf(input))
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
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
    repriceCartsStep(
      transform({ account, moved }, ({ account, moved }) => ({
        customer_id: account.customer_id,
        changed: moved.added + moved.removed > 0,
      }))
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse({ id: input.id })
  }
)

/** A closed wholesaler opened again: back in its groups, open carts at wholesale. */
export const reactivateAccountWorkflow = createWorkflow(
  "wholesale-reactivate-account",
  (input: StatusInput) => {
    const lock = transform({ input }, ({ input }) => lockOf(input))
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
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
    repriceCartsStep(
      transform({ account, moved }, ({ account, moved }) => ({
        customer_id: account.customer_id,
        changed: moved.added + moved.removed > 0,
      }))
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse({ id: input.id })
  }
)

/**
 * A pending wholesaler's invitation sent again (ADR-0068 §3, decision
 * 13): its 90 days start again from now. The message goes last; one that
 * does not go leaves the new date (the panel may send it once more).
 */
export const resendInvitationWorkflow = createWorkflow(
  "wholesale-resend-invitation",
  (input: StatusInput) => {
    const lock = transform({ input }, ({ input }) => lockOf(input))
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    checkAccountStep(
      transform({ input }, ({ input }) => ({ id: input.id, action: "resend" as const }))
    )
    patchAccountStep(
      transform({ input }, ({ input }) => ({
        id: input.id,
        patch: { invited_at: new Date(), updated_by: input.updated_by },
      }))
    )
    releaseLockStep({ key: lock })
    const sent = sendAccountMessageStep(
      transform({ input }, ({ input }) => ({ account_id: input.id }))
    )
    return new WorkflowResponse(
      transform({ input, sent }, ({ input, sent }) => ({ id: input.id, message: sent.message }))
    )
  }
)
