import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"

/** One audited event (`GET /admin/cp/audit-log`): never a value, a body's field names at most. */
export interface AuditEntry {
  id: string
  kind: "mutation" | "sensitive_read" | "system"
  actor_type: string | null
  actor_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  outcome: number | null
  changes: Record<string, unknown> | null
  request_id: string | null
  ip_hash: string | null
  created_at: string
}

export const AUDIT_PAGE_SIZE = 50

/** A page of the audit log (zero-based), newest first (owner; reading it is recorded too). */
export const auditQuery = (page: number) =>
  queryOptions({
    queryKey: ["audit-log", page],
    queryFn: () =>
      api<{ entries: AuditEntry[]; count: number }>("/admin/cp/audit-log", {
        query: { limit: AUDIT_PAGE_SIZE, offset: page * AUDIT_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })
