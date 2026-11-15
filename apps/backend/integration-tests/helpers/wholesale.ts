import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createCustomerGroupsWorkflow,
  linkCustomersToCustomerGroupWorkflow,
} from "@medusajs/medusa/core-flows"
import { WHOLESALE_MODULE } from "../../src/modules/wholesale"
import type WholesaleModuleService from "../../src/modules/wholesale/service"
import type { HttpClient } from "./http"
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

/** Staff calls of a wholesale spec, as the owner. */
export function wholesaleApi(http: HttpClient, headers: Record<string, string>) {
  const post = <T>(url: string, body: unknown) => settle(http.post<T>(url, body, { headers }))
  const get = <T>(url: string) => settle(http.get<T>(url, { headers }))
  const del = <T>(url: string) => settle(http.delete<T>(url, { headers }))
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
}

/** Staff calls on wholesalers (ADR-0068 slice 1b), as the given staff member. */
export function accountApi(http: HttpClient, headers: Record<string, string>) {
  const { post, get, del } = wholesaleApi(http, headers)
  return {
    create: (body: Record<string, unknown>) =>
      post<{ account: AccountAnswer; message: string; billing_profile: string }>(
        "/admin/wholesale/accounts",
        body
      ),
    /** A new wholesaler that must be made; its answer. */
    made: async (body: Record<string, unknown>) => {
      const made = await post<{ account: AccountAnswer }>("/admin/wholesale/accounts", body)
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
    action: (id: string, action: "deactivate" | "reactivate" | "invitation") =>
      post<{ account: AccountAnswer; message?: string }>(
        `/admin/wholesale/accounts/${id}/${action}`,
        {}
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
