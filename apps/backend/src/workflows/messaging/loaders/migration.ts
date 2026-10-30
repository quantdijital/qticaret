import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { MigrationInviteVars } from "../../../lib/messaging/templates"
import { brandOf } from "../brand"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

/** The storefront page that opens an account (F18 builds it), the address filled in. */
export const REGISTER_PATH = "/hesap/kayit"

/**
 * A moved customer's invitation (F14.5): to their own address, while no
 * account has that address yet (one opened meanwhile needs none). The link
 * needs the storefront's address: without a domain nothing is sent.
 */
export async function loadMigrationInvite(
  container: Container,
  customerId: string
): Promise<Loaded<MigrationInviteVars> | null> {
  const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const [customer] = await customers.listCustomers({ id: customerId }, { take: 1 })
  const { storefrontUrl } = await brandOf(container)
  if (!customer?.email || customer.has_account || !storefrontUrl) {
    return null
  }
  const accounts = await customers.listCustomers(
    { email: customer.email, has_account: true },
    { take: 1, select: ["id"] }
  )
  if (accounts.length > 0) {
    return null
  }
  return {
    vars: {
      registerUrl: `${storefrontUrl}${REGISTER_PATH}?${new URLSearchParams({ email: customer.email }).toString()}`,
    },
    recipients: { email: customer.email },
    receiverId: customer.id,
    resourceType: "customer",
  }
}
