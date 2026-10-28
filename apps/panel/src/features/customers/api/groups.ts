import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A segment's rules (adr/0037 §6); money in kuruş. */
export interface SegmentRules {
  min_total_spent?: number
  min_orders?: number
  ordered_within_days?: number
  not_ordered_for_days?: number
  registered?: boolean
  email_consent?: boolean
}

export interface CustomerSegment {
  id: string
  name: string
  rules: SegmentRules
  customer_group_id: string
  member_count: number
  refreshed_at: string | null
}

export interface CustomerGroupRow {
  id: string
  name: string
  /** Filled by a segment's rules: its members are not changed by hand. */
  segment: boolean
  members: number
}

interface GroupRecord {
  id: string
  name: string
  metadata: Record<string, unknown> | null
  customers?: { id: string }[] | null
}

/** The shop's customer groups with their member counts, by name. */
export const customerGroupsQuery = () =>
  queryOptions({
    queryKey: ["customer-groups", "list"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ customer_groups: GroupRecord[] }>("/admin/customer-groups", {
          query: { fields: "id,name,metadata,customers.id", limit: 200, order: "name" },
        })
      ).customer_groups.map((group): CustomerGroupRow => ({
        id: group.id,
        name: group.name,
        segment: group.metadata?.["managed_by"] === "segment",
        members: group.customers?.length ?? 0,
      })),
  })

export const createCustomerGroup = (name: string) =>
  sdk.client.fetch("/admin/customer-groups", { method: "POST", body: { name } })

export const renameCustomerGroup = (id: string, name: string) =>
  sdk.client.fetch(`/admin/customer-groups/${encodeURIComponent(id)}`, {
    method: "POST",
    body: { name },
  })

export const deleteCustomerGroup = (id: string) =>
  sdk.client.fetch(`/admin/customer-groups/${encodeURIComponent(id)}`, { method: "DELETE" })

/** The shop's segments (F10.3). */
export const customerSegmentsQuery = () =>
  queryOptions({
    queryKey: ["customer-segments"],
    queryFn: async () =>
      (await sdk.client.fetch<{ segments: CustomerSegment[] }>("/admin/customer-segments"))
        .segments,
  })

export const saveCustomerSegment = (
  id: string | null,
  body: { name: string; rules: SegmentRules }
) =>
  sdk.client.fetch<{ segment: CustomerSegment }>(
    id ? `/admin/customer-segments/${encodeURIComponent(id)}` : "/admin/customer-segments",
    { method: "POST", body }
  )

export const refreshCustomerSegment = (id: string) =>
  sdk.client.fetch<{ member_count: number }>(
    `/admin/customer-segments/${encodeURIComponent(id)}/refresh`,
    { method: "POST", body: {} }
  )

export const deleteCustomerSegment = (id: string) =>
  sdk.client.fetch(`/admin/customer-segments/${encodeURIComponent(id)}`, { method: "DELETE" })

/** The groups a customer is in. */
export const customerGroupIdsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["customers", "groups", customerId],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ customer: { groups?: { id: string }[] | null } }>(
          `/admin/customers/${encodeURIComponent(customerId)}`,
          { query: { fields: "id,groups.id" } }
        )
      ).customer.groups?.map(({ id }) => id) ?? [],
  })

/** Puts the customer in a group, or takes them out. */
export const setCustomerGroup = (customerId: string, groupId: string, member: boolean) =>
  sdk.client.fetch(`/admin/customers/${encodeURIComponent(customerId)}/customer-groups`, {
    method: "POST",
    body: member ? { add: [groupId] } : { remove: [groupId] },
  })
