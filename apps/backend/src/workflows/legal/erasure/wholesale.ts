import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { normalizeEmail } from "../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"

type Container = Pick<MedusaContainer, "resolve">

type Account = Awaited<ReturnType<WholesaleModuleService["listWholesaleAccounts"]>>[number]

/**
 * The wholesale accounts of a person's records (ADR-0068 §10): those
 * bound to the records, and an invitation still pending to one of their
 * addresses. Read before the records' addresses are erased.
 */
async function accountsOf(container: Container, records: string[]): Promise<Account[]> {
  const service = container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["email"],
    filters: { id: records },
    withDeleted: true,
  })
  const emails = [
    ...new Set(
      (data as { email?: string | null }[]).flatMap((row) =>
        row.email ? [normalizeEmail(row.email)] : []
      )
    ),
  ]
  const [bound, invited] = await Promise.all([
    service.listWholesaleAccounts({ customer_id: records }, { take: null }),
    emails.length === 0
      ? Promise.resolve([])
      : service.listWholesaleAccounts({ email: emails, status: "pending" }, { take: null }),
  ])
  return [...new Map([...bound, ...invited].map((account) => [account.id, account])).values()]
}

/**
 * A person's wholesale accounts erased (ADR-0068 §10): out of every
 * wholesale group, their own list (its prices and hand-entered marks) and
 * hidden group deleted, the account's link to the customer dismissed, and
 * the account itself, what named them cleared, soft-deleted (its ids still
 * tell its list's price events apart). Nothing is undone on a failure;
 * run again it finds only what is left. Returns how many accounts.
 */
export async function eraseWholesale(container: Container, records: string[]): Promise<number> {
  if (records.length === 0) {
    return 0
  }
  const service = container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
  const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const accounts = await accountsOf(container, records)
  const owned = await service.ownedIds()
  for (const account of accounts) {
    if (account.customer_id) {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "customer",
        fields: ["groups.id"],
        filters: { id: account.customer_id },
        withDeleted: true,
      })
      const groups = (
        (data[0] as { groups?: ({ id: string } | null)[] | null } | undefined)?.groups ?? []
      ).flatMap((group) => (group && owned.groupIds.has(group.id) ? [group.id] : []))
      if (groups.length > 0) {
        await customers.removeCustomerFromGroup(
          groups.map((customer_group_id) => ({
            customer_id: account.customer_id ?? "",
            customer_group_id,
          }))
        )
      }
      await container.resolve(ContainerRegistrationKeys.LINK).dismiss({
        [Modules.CUSTOMER]: { customer_id: account.customer_id },
        [WHOLESALE_MODULE]: { wholesale_account_id: account.id },
      })
    }
    if (account.private_price_list_id) {
      const marks = await service.listWholesaleManualPrices(
        { price_list_id: account.private_price_list_id },
        { select: ["id"], take: null }
      )
      if (marks.length > 0) {
        await service.deleteWholesaleManualPrices(marks.map((mark) => mark.id))
      }
      await container.resolve(Modules.PRICING).deletePriceLists([account.private_price_list_id])
    }
    if (account.private_group_id) {
      await customers.deleteCustomerGroups([account.private_group_id])
    }
    await service.updateWholesaleAccounts({
      id: account.id,
      email: null,
      company_name: null,
      contact_name: null,
    })
    await service.softDeleteWholesaleAccounts([account.id])
  }
  return accounts.length
}
