import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { z } from "zod"
import { sdk } from "@/lib/sdk"

/** One audit record (adr/0011); reading the log is itself recorded. */
export interface AuditEntry {
  id: string
  created_at: string
  kind: "mutation" | "sensitive_read" | "system"
  action: string
  actor_type: string | null
  actor_id: string | null
  resource_type: string | null
  resource_id: string | null
  /** The answer's HTTP status; null for the platform's own actions. */
  outcome: number | null
  /** Which fields a change sent and, where the resource has a snapshot, what each was and became. */
  changes: Record<string, unknown> | null
  request_id: string | null
  ip: string | null
  user_agent: string | null
}

export const AUDIT_PAGE_SIZE = 50
export const AUDIT_KINDS = ["all", "mutation", "sensitive_read", "system"] as const
export type AuditKind = (typeof AUDIT_KINDS)[number]
/** Who, besides a person: an integration's key or the platform itself (the API's names). */
export const AUDIT_ACTOR_TYPES = ["api-key", "system"] as const

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The viewer's filters in the address (F12.5), so a filtered view can be
 * passed on: `actor` is a staff member's id or one of AUDIT_ACTOR_TYPES,
 * `from`/`to` Turkish days.
 */
export const auditSearchSchema = z.object({
  kind: z.enum(AUDIT_KINDS).optional().catch(undefined),
  actor: z.string().min(1).max(256).optional().catch(undefined),
  resource: z.string().min(1).max(256).optional().catch(undefined),
  from: z.string().regex(DAY).optional().catch(undefined),
  to: z.string().regex(DAY).optional().catch(undefined),
})
export type AuditSearch = z.infer<typeof auditSearchSchema>

// Turkey has no daylight saving: a day is UTC+3 all year
const dayStart = (day: string) => new Date(`${day}T00:00:00.000+03:00`).toISOString()
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999+03:00`).toISOString()

/** The API's filters for what the address names; the export takes the same. */
export function auditFilters(search: AuditSearch): Record<string, string> {
  const actor = search.actor
  const byType = (AUDIT_ACTOR_TYPES as readonly string[]).includes(actor ?? "")
  return {
    ...(search.kind && search.kind !== "all" ? { kind: search.kind } : {}),
    ...(actor ? (byType ? { actor_type: actor } : { actor_id: actor }) : {}),
    ...(search.resource ? { resource_type: search.resource } : {}),
    ...(search.from ? { created_after: dayStart(search.from) } : {}),
    ...(search.to ? { created_before: dayEnd(search.to) } : {}),
  }
}

export const auditQuery = (search: AuditSearch, page: number) =>
  queryOptions({
    queryKey: ["settings", "audit", search, page],
    queryFn: () =>
      sdk.client.fetch<{ audit_entries: AuditEntry[]; count: number }>("/admin/audit-log", {
        query: {
          limit: AUDIT_PAGE_SIZE,
          offset: page * AUDIT_PAGE_SIZE,
          ...auditFilters(search),
        },
      }),
    placeholderData: keepPreviousData,
  })

/** The kinds of thing the log has entries for, for the resource filter. */
export const auditResourceTypesQuery = () =>
  queryOptions({
    queryKey: ["settings", "audit", "resource-types"],
    queryFn: () =>
      sdk.client.fetch<{ resource_types: string[] }>("/admin/audit-log/resource-types"),
    staleTime: 5 * 60_000,
  })

/**
 * Staff names for the log's "by" column, looked up by id: people taken off
 * the team since are still named while their login exists.
 */
export const staffNamesQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ["settings", "staff", ids],
    queryFn: async () => {
      const { users } = await sdk.admin.user.list({
        id: ids,
        fields: "id,email,first_name,last_name",
        limit: ids.length,
      })
      return new Map(
        users.map((user) => [
          user.id,
          [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
        ])
      )
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  })
