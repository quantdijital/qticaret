import { Modules } from "@medusajs/framework/utils"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, createRemoteLinkStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { normalizeEmail } from "../../../lib/wholesale"
import type { ProtectedProfileData } from "../../../modules/billing-profile/service"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import {
  activateAccountStep,
  resolveNewAccountStep,
  wholesaleBillingProfileStep,
  writeCustomerNamesStep,
} from "../steps/account-customer"
import { sendAccountMessageStep } from "../steps/account-message"
import { createAccountRowStep } from "../steps/account-rows"
import { syncMembershipsStep } from "../steps/memberships"
import { repriceCartsStep } from "../steps/carts"
import { openOwnListWorkflow } from "./own-list"

export interface CreateAccountInput {
  email: string
  company_name: string | null
  contact_name: string | null
  tier_id: string | null
  /** A list of the wholesaler's own (a rate and/or hand-entered prices on its page). */
  own_prices: boolean
  /** The own list's rate; opens the list. */
  rate_bps: number | null
  min_quantity: number | null
  /** The invoice identity staff typed, sealed with the customer it was sealed for. */
  billing: { customer_id: string; data: ProtectedProfileData } | null
  created_by: string | null
}

/**
 * A new wholesaler (ADR-0068 §3), steps undone in reverse if one fails:
 * the address checked, the account written, its own list opened if asked.
 * When the address has a registered customer the account is theirs and
 * active at once: names handed on, linked, in its groups (and out of the
 * segments'), open carts priced again, the invoice identity written, and
 * "your wholesale account is open" sent. Otherwise it waits, pending, for
 * the invitation to the storefront's sign-up page. The message goes last
 * and never undoes the rest.
 */
export const createAccountWorkflow = createWorkflow(
  // The address, names and sealed tax id pass through it: kept out of the workflow store (L3)
  { name: "wholesale-create-account", store: false },
  (input: CreateAccountInput) => {
    const lock = transform(
      { input },
      ({ input }) => `wholesale-email:${normalizeEmail(input.email)}`
    )
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    const found = resolveNewAccountStep(
      transform({ input }, ({ input }) => ({ email: input.email, tier_id: input.tier_id }))
    )
    const account = createAccountRowStep(
      transform({ input, found }, ({ input, found }) => ({
        email: normalizeEmail(input.email),
        company_name: input.company_name,
        contact_name: input.contact_name,
        tier_id: input.tier_id,
        rate_bps: input.rate_bps,
        min_quantity: input.min_quantity,
        invited_at: found.customer_id ? null : new Date(),
        created_by: input.created_by,
      }))
    )
    when(
      "wholesale-create-own-list",
      { input },
      ({ input }) => input.own_prices || input.rate_bps !== null
    ).then(() => {
      openOwnListWorkflow.runAsStep({
        input: transform({ account }, ({ account }) => ({ account_id: account.id })),
      })
    })
    when("wholesale-create-active", { found }, ({ found }) => found.customer_id !== null).then(
      () => {
        const bound = transform({ account, found }, ({ account, found }) => ({
          id: account.id,
          customer_id: found.customer_id ?? "",
        }))
        const activated = activateAccountStep(bound)
        writeCustomerNamesStep(
          transform({ found, activated }, ({ found, activated }) => ({
            customer_id: found.customer_id,
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
          transform({ account }, ({ account }) => ({ account_id: account.id }))
        )
        repriceCartsStep(
          transform({ found, moved }, ({ found, moved }) => ({
            customer_id: found.customer_id,
            changed: moved.added + moved.removed > 0,
          }))
        )
      }
    )
    const billing = wholesaleBillingProfileStep(
      transform({ input, found }, ({ input, found }) => ({
        customer_id: found.customer_id,
        billing: input.billing,
      }))
    )
    releaseLockStep({ key: lock })
    const sent = sendAccountMessageStep(
      transform({ account }, ({ account }) => ({ account_id: account.id }))
    )
    return new WorkflowResponse(
      transform({ account, found, billing, sent }, ({ account, found, billing, sent }) => ({
        id: account.id,
        status: found.customer_id ? ("active" as const) : ("pending" as const),
        billing_profile: billing,
        message: sent.message,
      }))
    )
  }
)
