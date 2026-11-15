import { Modules } from "@medusajs/framework/utils"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, createRemoteLinkStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { normalizeEmail } from "../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import {
  activateAccountStep,
  resolveNewAccountStep,
  wholesaleBillingProfileStep,
  writeCustomerNamesStep,
} from "../steps/account-customer"
import { ensureLoginStep } from "../steps/account-login"
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
  /** The password staff typed, sealed for the request (`sealPassword`); null when none. */
  sealed_password: string | null
  /** Staff take over an address whose sign-up never proved it (Ek 2026-11-15 (2), case 3). */
  take_over: boolean
  /** The invoice identity staff typed, sealed for the request (`billingBinding`). */
  billing: string | null
  created_by: string | null
}

/**
 * A new wholesaler (ADR-0068 §3, Ek 2026-11-15 (2)), steps undone in
 * reverse if one fails: the address checked, the account written, the
 * customer and its sign-in made or taken as the address allows
 * (`ensureLoginStep`: a new one with staff's password; a proven customer
 * keeping theirs; an unconfirmed sign-up only when staff take it over),
 * then the account bound and active at once: names handed on, linked, in
 * its groups (and out of the segments'), open carts priced again, the
 * invoice identity written. No message goes: staff hand the wholesaler
 * their password.
 */
export const createAccountWorkflow = createWorkflow(
  // The address, names, sealed password and tax id pass through it: kept out of the store (L3)
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
    const login = ensureLoginStep(
      transform({ input, found }, ({ input, found }) => ({
        email: input.email,
        login: found.login,
        sealed_password: input.sealed_password,
        take_over: input.take_over,
        contact_name: input.contact_name,
        company_name: input.company_name,
      }))
    )
    const account = createAccountRowStep(
      transform({ input }, ({ input }) => ({
        email: normalizeEmail(input.email),
        company_name: input.company_name,
        contact_name: input.contact_name,
        tier_id: input.tier_id,
        rate_bps: input.rate_bps,
        min_quantity: input.min_quantity,
        invited_at: null,
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
    const bound = transform({ account, login }, ({ account, login }) => ({
      id: account.id,
      customer_id: login.customer_id,
    }))
    const activated = activateAccountStep(bound)
    writeCustomerNamesStep(
      transform({ bound, activated }, ({ bound, activated }) => ({
        customer_id: bound.customer_id,
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
      transform({ bound, moved }, ({ bound, moved }) => ({
        customer_id: bound.customer_id,
        changed: moved.added + moved.removed > 0,
      }))
    )
    const billing = wholesaleBillingProfileStep(
      transform({ input, bound }, ({ input, bound }) => ({
        customer_id: bound.customer_id,
        email: input.email,
        billing: input.billing,
      }))
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ account, login, billing }, ({ account, login, billing }) => ({
        id: account.id,
        status: "active" as const,
        password: login.password,
        billing_profile: billing,
      }))
    )
  }
)
