import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { wholesale } from "../steps/account-rows"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Who may be in each wholesale group: a level's group holds its active
 * wholesalers, an own list's group its one active wholesaler.
 */
async function allowedMembers(container: Container): Promise<Map<string, Set<string>>> {
  const service = wholesale(container)
  const [tiers, accounts] = await Promise.all([
    service.listWholesaleTiers({}, { select: ["id", "customer_group_id"], take: null }),
    service.listWholesaleAccounts(
      {},
      { select: ["id", "status", "customer_id", "tier_id", "private_group_id"], take: null }
    ),
  ])
  const allowed = new Map<string, Set<string>>()
  const groupOfTier = new Map(tiers.map((tier) => [tier.id, tier.customer_group_id]))
  for (const tier of tiers) {
    allowed.set(tier.customer_group_id, new Set())
  }
  for (const account of accounts) {
    const active = account.status === "active" && account.customer_id
    if (account.private_group_id) {
      allowed.set(account.private_group_id, new Set(active ? [account.customer_id ?? ""] : []))
    }
    const tierGroup = account.tier_id ? groupOfTier.get(account.tier_id) : undefined
    if (active && tierGroup) {
      allowed.get(tierGroup)?.add(account.customer_id ?? "")
    }
  }
  return allowed
}

/**
 * The nightly check of the wholesale groups (security review L1): a
 * customer in a level's or an own list's group without the active account
 * that puts them there (a membership left by a crash between steps, or
 * written round the module) is taken out, so they pay retail. Nobody is
 * added here: joining is the account workflows' alone. Returns how many
 * memberships went.
 */
export async function reconcileWholesaleGroups(container: Container): Promise<number> {
  const allowed = await allowedMembers(container)
  const groupIds = [...allowed.keys()]
  if (groupIds.length === 0) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer_group",
    fields: ["id", "customers.id"],
    filters: { id: groupIds },
  })
  const strays = (data as { id: string; customers?: ({ id: string } | null)[] | null }[]).flatMap(
    (group) =>
      (group.customers ?? []).flatMap((customer) =>
        customer && !allowed.get(group.id)?.has(customer.id)
          ? [{ customer_id: customer.id, customer_group_id: group.id }]
          : []
      )
  )
  if (strays.length > 0) {
    await container
      .resolve<ICustomerModuleService>(Modules.CUSTOMER)
      .removeCustomerFromGroup(strays)
    logger.warn({ event: "wholesale.stray_members_removed", count: strays.length })
  }
  return strays.length
}
