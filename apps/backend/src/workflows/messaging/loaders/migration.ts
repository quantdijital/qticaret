import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { MigrationInviteVars } from "../../../lib/messaging/templates"
import { claimToken } from "../../../lib/migration/claim"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { brandOf } from "../brand"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

/** The storefront page that opens an account (F18 builds it), the address filled in. */
export const REGISTER_PATH = "/hesap/kayit"

/**
 * A moved customer's invitation (F14.5): to their own address, with the
 * key that lets the account they open (or have opened) take what moved;
 * none once the record was taken. No address in the link. The link needs
 * the storefront's address: without a domain nothing is sent.
 */
export async function loadMigrationInvite(
  container: Container,
  customerId: string
): Promise<Loaded<MigrationInviteVars> | null> {
  const [customer] = await container
    .resolve<ICustomerModuleService>(Modules.CUSTOMER)
    .listCustomers({ id: customerId, has_account: false }, { take: 1 })
  const [item] = await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationItems(
      { kind: "customer", target_id: customerId },
      { take: 1, select: ["adopted_at"] }
    )
  const { storefrontUrl } = await brandOf(container)
  if (!customer?.email || !item || item.adopted_at || !storefrontUrl) {
    return null
  }
  return {
    vars: {
      registerUrl: `${storefrontUrl}${REGISTER_PATH}?${new URLSearchParams({ davet: claimToken(customer.id) }).toString()}`,
    },
    recipients: { email: customer.email },
    receiverId: customer.id,
    resourceType: "customer",
  }
}
