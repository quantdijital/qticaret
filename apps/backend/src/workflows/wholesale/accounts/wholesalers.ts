import type { MedusaContainer } from "@medusajs/framework/types"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"

/**
 * The customers who buy at wholesale now (ADR-0068): an active account's.
 * A closed wholesaler pays retail and is any customer again.
 */
export async function activeWholesalers(
  container: Pick<MedusaContainer, "resolve">
): Promise<Set<string>> {
  const accounts = await container
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .listWholesaleAccounts(
      { status: "active", customer_id: { $ne: null } },
      { select: ["customer_id"], take: null }
    )
  return new Set(accounts.flatMap((account) => account.customer_id ?? []))
}
