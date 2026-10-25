import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Long tasks (adr/0014) as the API shows them; the result file's key stays on the server. */
export interface AsyncJob {
  id: string
  type: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  progress: number | null
  result_summary: Record<string, unknown> | null
  error_code: string | null
  created_at: string
  finished_at: string | null
  expires_at: string | null
  has_result: boolean
}

export const JOB_PAGE_SIZE = 20

export const jobsQuery = (page: number) =>
  queryOptions({
    queryKey: ["settings", "jobs", page],
    queryFn: () =>
      sdk.client.fetch<{ async_jobs: AsyncJob[]; count: number }>("/admin/async-jobs", {
        query: { limit: JOB_PAGE_SIZE, offset: page * JOB_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
    // A queued or running job moves on its own: look again until none is
    refetchInterval: (query) =>
      query.state.data?.async_jobs.some(
        (job) => job.status === "queued" || job.status === "running"
      )
        ? 3000
        : false,
  })

/** A short-lived link to a finished job's file; fetching it is a recorded read. */
export const jobResultUrl = async (id: string) =>
  (await sdk.client.fetch<{ url: string }>(`/admin/async-jobs/${encodeURIComponent(id)}/result`))
    .url

export function useStartJob() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { type: string; input: Record<string, unknown> }) =>
      sdk.client.fetch<{ async_job: AsyncJob }>("/admin/async-jobs", { method: "POST", body }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings", "jobs"] })
    },
  })
}

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
  outcome: string | null
  ip: string | null
}

export const AUDIT_PAGE_SIZE = 50
export const AUDIT_KINDS = ["all", "mutation", "sensitive_read", "system"] as const
export type AuditKind = (typeof AUDIT_KINDS)[number]

export const auditQuery = ({ kind, page }: { kind: AuditKind; page: number }) =>
  queryOptions({
    queryKey: ["settings", "audit", { kind, page }],
    queryFn: () =>
      sdk.client.fetch<{ audit_entries: AuditEntry[]; count: number }>("/admin/audit-log", {
        query: {
          limit: AUDIT_PAGE_SIZE,
          offset: page * AUDIT_PAGE_SIZE,
          ...(kind === "all" ? {} : { kind }),
        },
      }),
    placeholderData: keepPreviousData,
  })

/** Staff names for the audit log's "by" column, looked up by id. */
export const staffQuery = (ids: string[]) =>
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
