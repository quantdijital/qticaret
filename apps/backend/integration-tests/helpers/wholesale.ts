import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createCustomerGroupsWorkflow,
  linkCustomersToCustomerGroupWorkflow,
} from "@medusajs/medusa/core-flows"
import { randomUUID } from "node:crypto"
import { WHOLESALE_MODULE } from "../../src/modules/wholesale"
import { openOwnListWorkflow } from "../../src/workflows/wholesale/accounts/own-list"
import type WholesaleModuleService from "../../src/modules/wholesale/service"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"

export interface TierAnswer {
  id: string
  name: string
  percent: number | null
  min_quantity: number | null
  sync_pending: boolean
}

export interface LineAnswer {
  variant_id: string
  net: string
  gross: string
  source: "manual" | "rate"
  retail_now: string | null
  undercut: boolean
}

/** An answer as a spec asserts on it: status and body only, never axios' own objects. */
export interface PlainAnswer<T> {
  status: number
  data: T
}

/**
 * Settles a call to a plain answer. axios' response holds its request,
 * which holds the response back: such an object reaching a failed
 * assertion breaks Jest's worker ("Converting circular structure").
 */
async function plain<T>(request: Promise<HttpResponse<T>>): Promise<PlainAnswer<T>> {
  try {
    const { status, data } = await settle(request)
    return { status, data }
  } catch (error) {
    const { message, code } = error as { message?: unknown; code?: unknown }
    // The cause would carry axios' circular objects to Jest's worker: its text is enough
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`request failed without an answer: ${String(code)} ${String(message)}`)
  }
}

/** Staff calls of a wholesale spec, as the owner. */
export function wholesaleApi(http: HttpClient, headers: Record<string, string>) {
  const post = <T>(url: string, body: unknown) => plain(http.post<T>(url, body, { headers }))
  const get = <T>(url: string) => plain(http.get<T>(url, { headers }))
  const del = <T>(url: string) => plain(http.delete<T>(url, { headers }))
  return {
    post,
    get,
    del,
    flag: (enabled: boolean) => post("/admin/features/customers.wholesale", { enabled }),
    tier: async (body: Record<string, unknown>) => {
      const made = await post<{ tier: TierAnswer }>("/admin/wholesale/tiers", body)
      if (made.status !== 201) {
        throw new Error(`tier not made: ${String(made.status)} ${JSON.stringify(made.data)}`)
      }
      return made.data.tier
    },
    prices: (tierId: string, body: unknown) =>
      post<Record<string, unknown>>(`/admin/wholesale/tiers/${tierId}/prices`, body),
    /** A page of a level's lines; `query` as the panel sends it (`q=…&limit=…`). */
    lines: async (tierId: string, query = "") =>
      (
        await get<{
          lines: LineAnswer[]
          count: number
          undercut_count: number
          rate_zero: { count: number; variant_ids: string[] }
        }>(`/admin/wholesale/tiers/${tierId}/lines${query ? `?${query}` : ""}`)
      ).data,
  }
}

/** The Medusa group and list a level owns (its id is all the API gives). */
export async function tierRecords(container: MedusaContainer, tierId: string) {
  const tier = await container
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .retrieveWholesaleTier(tierId)
  return { groupId: tier.customer_group_id, priceListId: tier.price_list_id }
}

/** A customer put in a group as the module will (slice 1b): Medusa's workflow, not its route. */
export async function joinGroup(container: MedusaContainer, groupId: string, customerId: string) {
  await linkCustomersToCustomerGroupWorkflow(container).run({
    input: { id: groupId, add: [customerId], remove: [] },
  })
}

export interface AccountAnswer {
  id: string
  status: "pending" | "active" | "inactive"
  email: string | null
  company_name: string | null
  contact_name: string | null
  customer: { id: string; email: string | null } | null
  tier: { id: string; name: string } | null
  own_prices: boolean
  percent: number | null
  min_quantity: number | null
  invitation_expires_at: string | null
  invitations_sent: number | null
}

/** A throwaway password for this test database only, by the platform's rule. */
export const testPassword = () => `Toptan-${randomUUID()}`

/**
 * The body as staff send it: a password typed unless the test names one
 * (or names none: `password: undefined`), as the panel's form always does.
 */
const withPassword = (body: Record<string, unknown>) =>
  "password" in body ? body : { ...body, password: testPassword() }

/** Staff calls on wholesalers (ADR-0068 slice 1b, Ek 2026-11-15 (2)), as the given staff member. */
export function accountApi(http: HttpClient, headers: Record<string, string>) {
  const { post, get, del } = wholesaleApi(http, headers)
  return {
    create: (body: Record<string, unknown>) =>
      post<{ account: AccountAnswer; password: string; billing_profile: string }>(
        "/admin/wholesale/accounts",
        withPassword(body)
      ),
    /** A new wholesaler that must be made; its answer. */
    made: async (body: Record<string, unknown>) => {
      const made = await post<{ account: AccountAnswer }>(
        "/admin/wholesale/accounts",
        withPassword(body)
      )
      if (made.status !== 201) {
        throw new Error(`account not made: ${String(made.status)} ${JSON.stringify(made.data)}`)
      }
      return made.data.account
    },
    get: (id: string) => get<{ account: AccountAnswer }>(`/admin/wholesale/accounts/${id}`),
    list: (query = "") =>
      get<{ accounts: AccountAnswer[]; count: number }>(
        `/admin/wholesale/accounts${query ? `?${query}` : ""}`
      ),
    update: (id: string, body: Record<string, unknown>) =>
      post<{ account: AccountAnswer }>(`/admin/wholesale/accounts/${id}`, body),
    action: (id: string, action: "deactivate" | "reactivate") =>
      post<{ account: AccountAnswer }>(`/admin/wholesale/accounts/${id}/${action}`, {}),
    password: (id: string, password: string) =>
      post<{ account: AccountAnswer; signed_out: boolean }>(
        `/admin/wholesale/accounts/${id}/password`,
        { password }
      ),
    remove: (id: string) => del(`/admin/wholesale/accounts/${id}`),
    prices: (id: string, body: unknown) =>
      post<Record<string, unknown>>(`/admin/wholesale/accounts/${id}/prices`, body),
    lines: (id: string, query = "") =>
      get<{ lines: LineAnswer[]; count: number }>(
        `/admin/wholesale/accounts/${id}/lines${query ? `?${query}` : ""}`
      ),
  }
}

/**
 * A wholesaler invited before staff set passwords (Ek 2026-11-15 (2)):
 * pending under its address, written straight to the module (the API no
 * longer makes one), its own list opened when asked. For the claim,
 * expiry, removal and erasure paths that still serve such accounts.
 */
export async function legacyPendingAccount(
  container: MedusaContainer,
  fields: {
    email: string
    contact_name?: string
    company_name?: string
    tier_id?: string
    own_prices?: boolean
  }
): Promise<{ id: string }> {
  const service = container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
  const [account] = await service.createWholesaleAccounts([
    {
      email: fields.email.trim().toLowerCase(),
      contact_name: fields.contact_name ?? null,
      company_name: fields.company_name ?? null,
      tier_id: fields.tier_id ?? null,
      status: "pending",
      invited_at: new Date(),
    },
  ])
  if (!account) {
    throw new Error("pending account not made")
  }
  if (fields.own_prices) {
    await openOwnListWorkflow(container).run({ input: { account_id: account.id } })
  }
  return { id: account.id }
}

/** The Medusa group and list a wholesaler's own prices live in (the API gives its id only). */
export async function accountRecords(container: MedusaContainer, accountId: string) {
  const [account] = await container
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .listWholesaleAccounts({ id: accountId }, { take: 1, withDeleted: true })
  return {
    groupId: account?.private_group_id ?? null,
    priceListId: account?.private_price_list_id ?? null,
    customerId: account?.customer_id ?? null,
    deleted: account?.deleted_at !== null && account?.deleted_at !== undefined,
    email: account?.email ?? null,
  }
}

/** The ids of the groups a customer is in, as Medusa's customer module keeps them. */
export async function groupsOf(container: MedusaContainer, customerId: string) {
  const [customer] = await container
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: customerId }, { relations: ["groups"], take: 1 })
  return (customer?.groups ?? []).map((group) => group.id).sort()
}

/** A customer group of the shop's own (a segment's stand-in), the customer in it. */
export async function ownGroup(container: MedusaContainer, name: string, customerId: string) {
  const { result: groups } = await createCustomerGroupsWorkflow(container).run({
    input: { customersData: [{ name }] },
  })
  const groupId = groups[0]?.id ?? ""
  await joinGroup(container, groupId, customerId)
  return groupId
}
