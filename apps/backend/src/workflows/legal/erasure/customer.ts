import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { removeCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { erasedEmail } from "../../../lib/compliance/retention"
import { normalizeRecipient } from "../../../lib/messaging/recipients"
import { BILLING_PROFILE_MODULE } from "../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../modules/billing-profile/service"

type Container = Pick<MedusaContainer, "resolve">

interface Contact {
  email?: string | null
  phone?: string | null
  shipping_address?: { phone?: string | null } | null
  billing_address?: { phone?: string | null } | null
}

/**
 * Where the customer's messages went: their account's and their orders'
 * e-mails, and the phones texts went to, as written and as sent.
 */
export async function addressesOf(container: Container, customerId: string): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: customers }, { data: orders }] = await Promise.all([
    query.graph({
      entity: "customer",
      fields: ["email", "phone"],
      filters: { id: customerId },
      withDeleted: true,
    }),
    query.graph({
      entity: "order",
      fields: ["email", "shipping_address.phone", "billing_address.phone"],
      filters: { customer_id: customerId },
    }),
  ])
  const rows = [...customers, ...orders] as Contact[]
  const phones = rows.flatMap((row) => [
    row.phone,
    row.shipping_address?.phone,
    row.billing_address?.phone,
  ])
  const erased = erasedEmail(customerId)
  return [
    ...new Set(
      [
        ...rows.map((row) => row.email),
        ...phones,
        ...phones.map((phone) => (phone ? normalizeRecipient("sms", phone) : null)),
      ].filter((value): value is string => typeof value === "string" && !!value && value !== erased)
    ),
  ]
}

/**
 * The customer themselves (adr/0041 §6): a person's invoice identity and
 * its tax number deleted for good (a company's stays for the books), the
 * profile's name, e-mail and phone replaced, the addresses deleted, then
 * the sign-in removed and the record closed as Medusa does. The record
 * stays, erased: orders still point at it. Run again, it changes nothing
 * more.
 */
export async function eraseCustomer(container: Container, customerId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "has_account", "billing_profile.id", "billing_profile.type"],
    filters: { id: customerId },
    withDeleted: true,
  })
  const customer = data[0] as
    | {
        id: string
        has_account: boolean
        billing_profile?: { id: string; type: "individual" | "corporate" } | null
      }
    | undefined
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "customers.unknown")
  }
  // A company's invoice identity is no person's: the books keep reading it
  const profileId =
    customer.billing_profile?.type === "individual" ? customer.billing_profile.id : undefined
  if (profileId) {
    // For good: Medusa's customer deletion only soft-deletes it (its hook), tax number and all
    await container
      .resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
      .deleteBillingProfiles([profileId])
    await container.resolve(ContainerRegistrationKeys.LINK).dismiss({
      [Modules.CUSTOMER]: { customer_id: customerId },
      [BILLING_PROFILE_MODULE]: { billing_profile_id: profileId },
    })
  }
  const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  await customers.updateCustomers(customerId, {
    email: erasedEmail(customerId),
    first_name: null,
    last_name: null,
    phone: null,
    company_name: null,
    metadata: null,
  })
  // Medusa's deletion only soft-deletes the addresses with the customer
  const addresses = await customers.listCustomerAddresses(
    { customer_id: customerId },
    { select: ["id"] }
  )
  if (addresses.length > 0) {
    await customers.deleteCustomerAddresses(addresses.map((address) => address.id))
  }
  const [open] = await customers.listCustomers({ id: customerId }, { select: ["id"], take: 1 })
  if (open) {
    try {
      // The sign-in goes (a guest has none), then the record is closed
      await removeCustomerAccountWorkflow(container as MedusaContainer).run({
        input: { customerId },
      })
    } catch (error) {
      // An account whose sign-in is already gone: only the record is left to close
      if (!(error instanceof Error) || !/auth identity/i.test(error.message)) {
        throw error
      }
      await customers.softDeleteCustomers([customerId])
    }
  }
  return { billing_profile: Boolean(profileId), addresses: addresses.length }
}
