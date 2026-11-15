import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, createRemoteLinkStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { isInviteLive, normalizeEmail } from "../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import { activateAccountStep, writeCustomerNamesStep } from "../steps/account-customer"
import { wholesale } from "../steps/account-rows"
import { repriceCartsStep } from "../steps/carts"
import { syncMembershipsStep } from "../steps/memberships"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The pending account a signed-in customer may take (ADR-0068 §3), on the
 * proof `attachGuestOrders` takes: an account with a sign-in (signing in
 * proved the address: an e-mail login is confirmed first, a social
 * provider vouches for it), whose address is the invitation's, with no
 * wholesale account of its own, the invitation not past its 90 days.
 * Null when there is none: the usual answer, and a cheap one.
 */
export async function claimableAccount(
  container: Container,
  customerId: string,
  now: Date = new Date()
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "email", "has_account"],
    filters: { id: customerId },
  })
  const customer = data[0] as { email: string | null; has_account: boolean } | undefined
  if (!customer?.has_account || !customer.email) {
    return null
  }
  const service = wholesale(container)
  const [pending] = await service.listWholesaleAccounts(
    { email: normalizeEmail(customer.email), status: "pending" },
    { select: ["id", "invited_at"], take: 1 }
  )
  if (!pending || !isInviteLive(pending.invited_at ?? null, now)) {
    return null
  }
  const own = await service.listWholesaleAccounts(
    { customer_id: customerId },
    { select: ["id"], take: 1 }
  )
  return own.length > 0 ? null : pending.id
}

const findClaimStep = createStep(
  "wholesale-find-claim",
  async (input: { customer_id: string }, { container }) =>
    new StepResponse({ account_id: await claimableAccount(container, input.customer_id) })
)

/**
 * The invited wholesaler signed in (ADR-0068 §3): the pending account
 * becomes theirs and active, the names it held handed to the customer
 * record where blank, linked, the customer in its groups (out of the
 * segments'), and an open cart priced again. Run again it finds nothing.
 * No Store write route: it runs on the customer reading their account.
 */
export const claimAccountWorkflow = createWorkflow(
  "wholesale-claim-account",
  (input: { customer_id: string }) => {
    const lock = transform({ input }, ({ input }) => `wholesale-claim:${input.customer_id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    const found = findClaimStep(input)
    const claimed = when(
      "wholesale-claim-found",
      { found },
      ({ found }) => !!found.account_id
    ).then(() => {
      const bound = transform({ input, found }, ({ input, found }) => ({
        id: found.account_id ?? "",
        customer_id: input.customer_id,
      }))
      const activated = activateAccountStep(bound)
      writeCustomerNamesStep(
        transform({ input, activated }, ({ input, activated }) => ({
          customer_id: input.customer_id,
          names: activated.fill,
        }))
      )
      createRemoteLinkStep(
        transform({ bound }, ({ bound }) => [
          {
            [Modules.CUSTOMER]: { customer_id: bound.customer_id },
            [WHOLESALE_MODULE]: { wholesale_account_id: bound.id },
          },
        ])
      )
      const moved = syncMembershipsStep(
        transform({ bound }, ({ bound }) => ({ account_id: bound.id }))
      )
      repriceCartsStep(
        transform({ input, moved }, ({ input, moved }) => ({
          customer_id: input.customer_id,
          changed: moved.added + moved.removed > 0,
        }))
      )
      return bound
    })
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ claimed }, ({ claimed }) => ({ account_id: claimed?.id ?? null }))
    )
  }
)
