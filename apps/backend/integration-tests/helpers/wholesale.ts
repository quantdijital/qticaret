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

/**
 * A wholesaler's own list as slice 1b will open it (ADR-0068 §3 step 4):
 * a one-member hidden group, an `override` list for it and the account
 * that owns both. Its rows are written through the module.
 */
export async function privateList(container: MedusaContainer, customerId: string) {
  const { result: groups } = await createCustomerGroupsWorkflow(container).run({
    input: {
      customersData: [{ name: `Toptancı ${customerId}`, metadata: { managed_by: "wholesale" } }],
    },
  })
  const groupId = groups[0]?.id ?? ""
  const lists = await container.resolve(Modules.PRICING).createPriceLists([
    {
      title: `Toptancı ${customerId}`,
      description: "",
      type: "override",
      status: "active",
      rules: { "customer.groups.id": [groupId] },
    },
  ])
  const priceListId = lists[0]?.id ?? ""
  const account = await container
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .createWholesaleAccounts({
      customer_id: customerId,
      status: "active",
      private_group_id: groupId,
      private_price_list_id: priceListId,
    })
  await joinGroup(container, groupId, customerId)
  return { accountId: account.id, groupId, priceListId }
}
