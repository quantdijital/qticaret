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
import { provenCustomer } from "../../account/proven-customer"
import { activateAccountStep, writeCustomerNamesStep } from "../steps/account-customer"
import { wholesale } from "../steps/account-rows"
import { repriceCartsStep } from "../steps/carts"
import { syncMembershipsStep } from "../steps/memberships"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The pending account a signed-in customer may take (ADR-0068 §3): the
 * invitation's address is theirs, they have no wholesale account of their
 * own, the invitation is not past its days, and they have proven the
 * address (security review H1: `has_account` alone is not proof; see
 * `provenCustomer`). Null when there is none: the usual answer, and a
 * cheap one, the proof read last.
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
    { select: ["id", "invited_at", "created_at"], take: 1 }
  )
  if (
    !pending ||
    !isInviteLive({ invitedAt: pending.invited_at ?? null, openedAt: pending.created_at }, now)
  ) {
    return null
  }
  const own = await service.listWholesaleAccounts(
    { customer_id: customerId },
    { select: ["id"], take: 1 }
  )
  if (own.length > 0) {
    return null
  }
  return (await provenCustomer(container, customerId)) ? pending.id : null
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
 * segments'), and their open carts priced again. Under the customer's
 * lock and the account's (the one staff changes take, review L1); the
 * activation refuses an account bound to someone else meanwhile. Run
 * again it finds nothing. No Store write route: it runs on the customer
 * reading their account. Kept out of the workflow store: names pass
 * through it (review L3).
 */
export const claimAccountWorkflow = createWorkflow(
  { name: "wholesale-claim-account", store: false },
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
      const accountLock = transform({ bound }, ({ bound }) => `wholesale-account:${bound.id}`)
      acquireLockStep({ key: accountLock, timeout: 5, ttl: 60 }).config({
        name: "wholesale-claim-account-lock",
      })
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
      releaseLockStep({ key: accountLock }).config({ name: "wholesale-claim-account-unlock" })
      return bound
    })
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ claimed }, ({ claimed }) => ({ account_id: claimed?.id ?? null }))
    )
  }
)
