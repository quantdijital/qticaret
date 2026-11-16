import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { inviteExpiresAt } from "../../../lib/wholesale"
import type { AccountStatus } from "../../../lib/wholesale"
import { wholesale } from "../steps/account-rows"
import type { AccountRecord } from "../steps/account-rows"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A wholesaler as the panel reads it (ADR-0068 §3): the address, company
 * and contact from the account while pending and from the customer record
 * once bound (the one source). The Medusa group and list ids stay inside
 * (§9, IDOR): whether there is an own list is all that is said.
 */
export interface AccountRead {
  id: string
  status: AccountStatus
  email: string | null
  company_name: string | null
  contact_name: string | null
  customer: { id: string; email: string | null } | null
  tier: { id: string; name: string } | null
  own_prices: boolean
  /** The sign-in is one staff made or took over: staff may set its password (review M4). */
  staff_login: boolean
  rate_bps: number | null
  min_quantity: number | null
  sync_pending: boolean
  invited_at: Date | null
  invitation_expires_at: Date | null
  /** While pending: how many times the invitation went out, the first counted. */
  invitations_sent: number | null
  activated_at: Date | null
  deactivated_at: Date | null
  created_at: Date
}

interface CustomerRow {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
}

const date = (value: Date | string | null | undefined): Date | null =>
  value ? new Date(value) : null

const fullName = (customer: CustomerRow): string | null =>
  [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || null

function readOf(
  account: AccountRecord,
  customer: CustomerRow | undefined,
  tierName: string | undefined
): AccountRead {
  const invited = date(account.invited_at)
  const requested = date(account.sync_requested_at)
  const synced = date(account.synced_at)
  return {
    id: account.id,
    status: account.status,
    email: customer ? customer.email : (account.email ?? null),
    company_name: customer ? customer.company_name : (account.company_name ?? null),
    contact_name: customer ? fullName(customer) : (account.contact_name ?? null),
    customer: customer ? { id: customer.id, email: customer.email } : null,
    tier: account.tier_id && tierName ? { id: account.tier_id, name: tierName } : null,
    own_prices: account.private_price_list_id !== null,
    staff_login: account.staff_login,
    rate_bps: account.rate_bps ?? null,
    min_quantity: account.min_quantity ?? null,
    sync_pending: requested !== null && (synced === null || synced < requested),
    invited_at: invited,
    invitation_expires_at:
      account.status === "pending" && invited
        ? inviteExpiresAt({ invitedAt: invited, openedAt: account.created_at })
        : null,
    invitations_sent: account.status === "pending" ? account.invite_count : null,
    activated_at: date(account.activated_at),
    deactivated_at: date(account.deactivated_at),
    created_at: new Date(account.created_at),
  }
}

async function readAll(container: Container, accounts: AccountRecord[]): Promise<AccountRead[]> {
  const customerIds = accounts.flatMap((account) => account.customer_id ?? [])
  const tierIds = [...new Set(accounts.flatMap((account) => account.tier_id ?? []))]
  const [{ data }, tiers] = await Promise.all([
    customerIds.length === 0
      ? Promise.resolve({ data: [] as unknown[] })
      : container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "customer",
          fields: ["id", "email", "first_name", "last_name", "company_name"],
          filters: { id: customerIds },
        }),
    tierIds.length === 0
      ? Promise.resolve([])
      : wholesale(container).listWholesaleTiers(
          { id: tierIds },
          { select: ["id", "name"], take: null }
        ),
  ])
  const customers = new Map((data as CustomerRow[]).map((row) => [row.id, row]))
  const tierNames = new Map(tiers.map((tier) => [tier.id, tier.name]))
  return accounts.map((account) =>
    readOf(
      account,
      account.customer_id ? customers.get(account.customer_id) : undefined,
      account.tier_id ? tierNames.get(account.tier_id) : undefined
    )
  )
}

/** One wholesaler, or null. */
export async function readAccount(container: Container, id: string): Promise<AccountRead | null> {
  const [account] = await wholesale(container).listWholesaleAccounts({ id }, { take: 1 })
  return account ? ((await readAll(container, [account]))[0] ?? null) : null
}

const fold = (text: string): string => text.toLocaleLowerCase("tr")

/** Whether every word of the search is somewhere in the address, company or contact. */
export function accountMatches(account: AccountRead, q: string | undefined): boolean {
  const words = fold(q ?? "")
    .split(/\s+/)
    .filter((word) => word.length > 0)
  const text = fold(
    [account.email ?? "", account.company_name ?? "", account.contact_name ?? ""].join(" ")
  )
  return words.every((word) => text.includes(word))
}

export interface AccountsQuery {
  limit: number
  offset: number
  q?: string | undefined
  status?: AccountStatus | undefined
}

/**
 * A page of the shop's wholesalers, newest first. A shop's wholesalers fit
 * one read (as its levels do); the search runs over what the panel shows,
 * the customer record's names included, so it is done here.
 */
export async function readAccounts(
  container: Container,
  query: AccountsQuery
): Promise<{ accounts: AccountRead[]; count: number }> {
  const accounts = await wholesale(container).listWholesaleAccounts(
    query.status ? { status: query.status } : {},
    { take: null, order: { created_at: "DESC" } }
  )
  const found = (await readAll(container, accounts)).filter((account) =>
    accountMatches(account, query.q)
  )
  return {
    accounts: found.slice(query.offset, query.offset + query.limit),
    count: found.length,
  }
}
