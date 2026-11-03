import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AsyncJob } from "@/features/settings/api/activity"
import { wordpressUploadPath, wxrContentType } from "@/features/settings/api/migration-wordpress"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** Moving the shop in from its old platform (F14, adr/0042): what the panel reads and starts. */

export type MigrationSourceKind = "shopify" | "wordpress" | "feed" | "customers" | "bundle"
export type MigrationMode = "check" | "apply"
export type MigrationJob = AsyncJob & { error_message: string | null }

/** The owner's parcel for a product without measurements: grams and cm. */
export interface Parcel {
  weight: number
  length: number
  width: number
  height: number
}

export type KindCounts = Record<
  "read" | "created" | "found" | "updated" | "skipped" | "failed",
  number
>

export interface MigrationRun {
  id: string
  source: string
  mode: MigrationMode
  status: "running" | "done" | "failed"
  /**
   * Why a failed run stopped: `interrupted` (its worker stopped half-way:
   * it can start again), `restarted` (started again already), or the job's code.
   */
  error_code: string | null
  job_id: string | null
  counts: Partial<Record<string, KindCounts>>
  created_at: string
  finished_at: string | null
}

export const MIGRATION_KEY = ["migration"] as const

export const migrationRunsQuery = () =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "runs"],
    queryFn: async () =>
      (await sdk.client.fetch<{ runs: MigrationRun[] }>("/admin/migrations")).runs,
    staleTime: 5_000,
  })

const isRunning = (job: MigrationJob | undefined) =>
  job?.status === "queued" || job?.status === "running"

/** A migration's job, looked at again every second while it runs. */
export const migrationJobQuery = (id: string | null) =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "job", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ async_job: MigrationJob }>(`/admin/async-jobs/${id ?? ""}`))
        .async_job,
    enabled: id !== null,
    refetchInterval: (query) => (isRunning(query.state.data) ? 1000 : false),
  })

/**
 * A file sent as it is (not through the SDK, which would send JSON), typed
 * as the browser names it unless the source says; an error carries the status.
 */
async function sendFile(
  path: string,
  file: File,
  headers: Record<string, string> = {},
  type = file.type || "application/octet-stream"
): Promise<MigrationJob> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": type, ...headers },
    body: file,
  })
  const data = (await response.json().catch(() => ({}))) as {
    async_job?: MigrationJob
    message?: string
  }
  if (!response.ok || !data.async_job) {
    throw Object.assign(new Error(data.message ?? "upload failed"), {
      status: response.status,
      message: data.message,
    })
  }
  return data.async_job
}

const parcelQuery = (parcel: Parcel | null) =>
  parcel
    ? `&${new URLSearchParams(
        Object.entries(parcel).map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ""

export interface StartMigration {
  kind: MigrationSourceKind
  mode: MigrationMode
  parcel: Parcel | null
  file?: File | null
  url?: string
  /** A WordPress export's product category address base; empty, the server reads it. */
  categoryBase?: string
}

/** Starts a check or a run from the chosen source; applying asks the owner to prove it again. */
export function useStartMigration() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: StartMigration) =>
      withReauth(async (extra) => {
        if (input.kind === "wordpress") {
          const file = input.file ?? new File([], "bos.xml")
          return sendFile(
            wordpressUploadPath(input.mode, input.parcel, input.categoryBase ?? ""),
            file,
            extra.headers,
            wxrContentType(file)
          )
        }
        if (input.kind === "bundle" || input.kind === "customers") {
          const path = input.kind === "bundle" ? "/admin/migrations" : "/admin/migrations/customers"
          return sendFile(
            `${path}?mode=${input.mode}${input.kind === "bundle" ? parcelQuery(input.parcel) : ""}`,
            input.file ?? new File([], "bos"),
            extra.headers
          )
        }
        const body = {
          mode: input.mode,
          defaults: input.parcel,
          ...(input.kind === "feed" ? { url: input.url ?? "" } : {}),
        }
        return (
          await sdk.client.fetch<{ async_job: MigrationJob }>(`/admin/migrations/${input.kind}`, {
            method: "POST",
            body,
            ...extra,
          })
        ).async_job
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: MIGRATION_KEY }),
  })
}

/**
 * Starts a run that stopped half-way again, from the file it stored (the
 * server answers `migration.source_file_gone` when it is no longer kept);
 * an apply asks the owner to prove it again.
 */
export function useRestartMigration() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) =>
      withReauth(
        async (extra) =>
          (
            await sdk.client.fetch<{ async_job: MigrationJob }>(
              `/admin/migrations/${encodeURIComponent(runId)}/restart`,
              { method: "POST", body: {}, ...extra }
            )
          ).async_job
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: MIGRATION_KEY }),
  })
}

export interface ShopifySettings {
  shop_domain: string
  client_id: string
}

export interface Cutover {
  id: string
  cutover_at: string
  watch_until: string
}

export const cutoverQuery = () =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "cutover"],
    queryFn: async () =>
      (await sdk.client.fetch<{ cutover: Cutover | null }>("/admin/migrations/cutover")).cutover,
  })

export function useMarkCutover() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ cutover: Cutover }>("/admin/migrations/cutover", {
        method: "POST",
        body: {},
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: MIGRATION_KEY }),
  })
}

export interface InviteStatus {
  queued: number
  invited: number
  waiting: number
  today: number
}

export const inviteStatusQuery = () =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "invites"],
    queryFn: async () =>
      (await sdk.client.fetch<{ invites: InviteStatus }>("/admin/migrations/invites")).invites,
  })

/** Every moved customer asked, a share a day; the owner proves it again (it mails customers). */
export function useStartInvites() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      withReauth(
        async (extra) =>
          (
            await sdk.client.fetch<{ async_job: MigrationJob }>("/admin/migrations/invites", {
              method: "POST",
              body: {},
              ...extra,
            })
          ).async_job
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: MIGRATION_KEY }),
  })
}
