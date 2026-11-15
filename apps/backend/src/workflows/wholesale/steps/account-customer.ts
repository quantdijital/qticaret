import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { likeLiteral } from "../../../lib/db/like"
import { namesToFill, normalizeEmail } from "../../../lib/wholesale"
import type { CustomerNames } from "../../../lib/wholesale"
import { BILLING_PROFILE_MODULE } from "../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../modules/billing-profile/service"
import type { ProtectedProfileData } from "../../../modules/billing-profile/service"
import { provenCustomer } from "../../account/proven-customer"
import { accountById, wholesale } from "./account-rows"

/**
 * The customer behind a wholesaler's account (ADR-0068 §1, §3): found by
 * the address, given the account's names where it has none, and its
 * invoice identity when staff typed one.
 */

type Container = Pick<MedusaContainer, "resolve">

interface CustomerRow extends CustomerNames {
  id: string
  email: string | null
  has_account: boolean
}

const NAME_FIELDS = ["id", "email", "has_account", "first_name", "last_name", "company_name"]

/**
 * The customer with a sign-in at this address who has proven they own it
 * (`provenCustomer`), or null. An account registered with the address but
 * never confirmed counts as none (security review H1): the wholesaler is
 * then invited, and the account is taken on a proven sign-in.
 */
export async function registeredCustomer(
  container: Container,
  email: string
): Promise<CustomerRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: NAME_FIELDS,
    filters: { email: { $ilike: likeLiteral(normalizeEmail(email)) }, has_account: true },
  })
  const customer = (data[0] as CustomerRow | undefined) ?? null
  return customer && (await provenCustomer(container, customer.id)) ? customer : null
}

/**
 * What a new account starts from: the address has no account yet (as a
 * pending invitation or a customer's), the level named exists, and the
 * customer with a sign-in at the address, if there is one. Read only.
 */
export const resolveNewAccountStep = createStep(
  "wholesale-resolve-new-account",
  async (input: { email: string; tier_id: string | null }, { container }) => {
    const service = wholesale(container)
    const email = normalizeEmail(input.email)
    const customer = await registeredCustomer(container, email)
    const [pending, owned] = await Promise.all([
      service.listWholesaleAccounts({ email }, { select: ["id"], take: 1 }),
      customer
        ? service.listWholesaleAccounts({ customer_id: customer.id }, { select: ["id"], take: 1 })
        : Promise.resolve([]),
    ])
    if (pending.length > 0 || owned.length > 0) {
      throw new ConflictError("wholesale.exists")
    }
    if (input.tier_id !== null) {
      const [tier] = await service.listWholesaleTiers(
        { id: input.tier_id },
        { select: ["id"], take: 1 }
      )
      if (!tier) {
        throw new ValidationError("wholesale.tier_unknown", { field: "tier_id" })
      }
    }
    return new StepResponse({ customer_id: customer?.id ?? null })
  }
)

async function customerNames(container: Container, id: string): Promise<CustomerRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: NAME_FIELDS,
    filters: { id },
  })
  return (data[0] as CustomerRow | undefined) ?? null
}

/**
 * A pending account bound to its customer and made active (ADR-0068 §1):
 * the address, company and contact it held leave it (the customer record
 * is the one source from now on); what the customer has left blank of
 * them is handed on. A second run on an active account changes nothing.
 * Undone by putting the account back as it was.
 */
export const activateAccountStep = createStep(
  "wholesale-activate-account",
  async (input: { id: string; customer_id: string }, { container }) => {
    const account = await accountById(container, input.id)
    if (account.status !== "pending") {
      // Taken by this customer already: nothing to do; bound to another meanwhile: refused (L1)
      if (account.customer_id !== input.customer_id) {
        throw new ConflictError("wholesale.account_not_pending")
      }
      return new StepResponse({ fill: {} }, null)
    }
    const customer = await customerNames(container, input.customer_id)
    const fill = customer
      ? namesToFill(customer, {
          company_name: account.company_name ?? null,
          contact_name: account.contact_name ?? null,
        })
      : {}
    const before = {
      id: account.id,
      status: "pending" as const,
      customer_id: account.customer_id ?? null,
      email: account.email ?? null,
      company_name: account.company_name ?? null,
      contact_name: account.contact_name ?? null,
      activated_at: account.activated_at ?? null,
    }
    await wholesale(container).updateWholesaleAccounts({
      id: account.id,
      status: "active",
      customer_id: input.customer_id,
      email: null,
      company_name: null,
      contact_name: null,
      activated_at: new Date(),
    })
    return new StepResponse({ fill }, before)
  },
  async (before, { container }) => {
    if (before) {
      await wholesale(container).updateWholesaleAccounts(before)
    }
  }
)

/** Names written to the customer record; undone by writing the old ones back. */
export const writeCustomerNamesStep = createStep(
  "wholesale-write-customer-names",
  async (input: { customer_id: string | null; names: Partial<CustomerNames> }, { container }) => {
    const keys = Object.keys(input.names) as (keyof CustomerNames)[]
    if (!input.customer_id || keys.length === 0) {
      return new StepResponse(undefined, null)
    }
    const customer = await customerNames(container, input.customer_id)
    if (!customer) {
      return new StepResponse(undefined, null)
    }
    const before: Partial<CustomerNames> = {}
    for (const key of keys) {
      before[key] = customer[key] ?? null
    }
    await container
      .resolve<ICustomerModuleService>(Modules.CUSTOMER)
      .updateCustomers(input.customer_id, input.names)
    return new StepResponse(undefined, { id: input.customer_id, before })
  },
  async (undo, { container }) => {
    if (undo) {
      await container
        .resolve<ICustomerModuleService>(Modules.CUSTOMER)
        .updateCustomers(undo.id, undo.before)
    }
  }
)

/**
 * The invoice identity staff typed (adr/0009), sealed in the route with
 * the customer's id: written only to that customer, and only when they
 * have none; a profile of their own stays theirs. Undone by removing it.
 */
export const wholesaleBillingProfileStep = createStep(
  "wholesale-billing-profile",
  async (
    input: {
      customer_id: string | null
      billing: { customer_id: string; data: ProtectedProfileData } | null
    },
    { container }
  ) => {
    const { billing, customer_id } = input
    if (!billing || !customer_id || billing.customer_id !== customer_id) {
      return new StepResponse("none" as const, null)
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "customer",
      fields: ["billing_profile.id"],
      filters: { id: customer_id },
    })
    if ((data[0] as { billing_profile?: { id: string } | null } | undefined)?.billing_profile) {
      return new StepResponse("kept" as const, null)
    }
    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    const profile = await service.createBillingProfiles(billing.data)
    await container.resolve(ContainerRegistrationKeys.LINK).create({
      [Modules.CUSTOMER]: { customer_id },
      [BILLING_PROFILE_MODULE]: { billing_profile_id: profile.id },
    })
    return new StepResponse("written" as const, { customer_id, profile_id: profile.id })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await container.resolve(ContainerRegistrationKeys.LINK).dismiss({
      [Modules.CUSTOMER]: { customer_id: undo.customer_id },
      [BILLING_PROFILE_MODULE]: { billing_profile_id: undo.profile_id },
    })
    await container
      .resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
      .deleteBillingProfiles([undo.profile_id])
  }
)
