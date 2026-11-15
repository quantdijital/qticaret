import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { namesToFill, normalizeEmail } from "../../../lib/wholesale"
import type { CustomerNames } from "../../../lib/wholesale"
import { BILLING_PROFILE_MODULE } from "../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../modules/billing-profile/service"
import { openForRequest } from "../../../lib/staff/account"
import { addressLogin } from "./account-login"
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
 * What a new account starts from (ADR-0068 Ek 2026-11-15 (2)): who signs
 * in at the address (`addressLogin`), no wholesaler there yet (as an
 * older pending invitation or a customer's account), and the level named.
 * Read only.
 */
export const resolveNewAccountStep = createStep(
  "wholesale-resolve-new-account",
  async (input: { email: string; tier_id: string | null }, { container }) => {
    const service = wholesale(container)
    const email = normalizeEmail(input.email)
    const login = await addressLogin(container, email)
    const customerId =
      login.kind === "proven" || login.kind === "unproven" ? login.customer_id : null
    const [pending, owned] = await Promise.all([
      service.listWholesaleAccounts({ email }, { select: ["id"], take: 1 }),
      customerId
        ? service.listWholesaleAccounts({ customer_id: customerId }, { select: ["id"], take: 1 })
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
    return new StepResponse({ login })
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

/** What binds the typed invoice identity, sealed in the route, to its address. */
export const billingBinding = (email: string) => `wholesale.billing:${email}`

/** The invoice identity staff typed, as the route seals it. */
export interface TypedBilling {
  legal_name: string
  tax_office: string
  tax_id: string
}

/**
 * The invoice identity staff typed (adr/0009), sealed in the route for
 * the request and opened here once the customer is known: encrypted for
 * that customer, written only when they have none; a profile of their
 * own stays theirs. Undone by removing it.
 */
export const wholesaleBillingProfileStep = createStep(
  "wholesale-billing-profile",
  async (
    input: { customer_id: string | null; email: string; billing: string | null },
    { container }
  ) => {
    const { customer_id } = input
    if (!input.billing || !customer_id) {
      return new StepResponse("none" as const, null)
    }
    const typed = JSON.parse(
      openForRequest(input.billing, billingBinding(normalizeEmail(input.email)))
    ) as TypedBilling
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "customer",
      fields: ["billing_profile.id"],
      filters: { id: customer_id },
    })
    if ((data[0] as { billing_profile?: { id: string } | null } | undefined)?.billing_profile) {
      return new StepResponse("kept" as const, null)
    }
    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    const profile = await service.createBillingProfiles(
      service.prepareProfileData({ type: "corporate", ...typed }, customer_id)
    )
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
