import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AsyncJob } from "@/features/settings/api/activity"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** Moving the shop in from its old platform (F14, adr/0042): what the panel reads and starts. */

export type MigrationSourceKind = "shopify" | "feed" | "customers" | "bundle"
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

/** A file sent as it is (not through the SDK, which would send JSON); an error carries the status. */
async function sendFile(
  path: string,
  file: File,
  headers: Record<string, string> = {}
): Promise<MigrationJob> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": file.type || "application/octet-stream", ...headers },
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
}

/** Starts a check or a run from the chosen source; applying asks the owner to prove it again. */
export function useStartMigration() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: StartMigration) =>
      withReauth(async (extra) => {
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

export interface ShopifySettings {
  shop_domain: string
  client_id: string
}

/** The old site's addresses (F14.7): one row of the inventory, what it answers and what an apply does. */
export interface OldAddress {
  id: string
  address: string
  origins: string[]
  clicks: number | null
  entity_type: string | null
  decision: "auto" | "redirect" | "gone"
  target: string | null
  outcome: string | null
  state: "live" | "redirected" | "gone" | "not_found"
  location?: string
  action: "covered" | "reserve" | "redirect" | "gone" | "undecided" | "unsupported"
}

export const URL_FILTERS = ["all", "undecided", "matched", "decided", "unsupported"] as const
export type UrlFilter = (typeof URL_FILTERS)[number]

export const addressesQuery = (filter: UrlFilter, offset: number) =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "urls", filter, offset],
    queryFn: () =>
      sdk.client.fetch<{ urls: OldAddress[]; count: number; limit: number }>(
        `/admin/migrations/urls?filter=${filter}&offset=${String(offset)}`
      ),
  })

export interface AddressSummary {
  total: number
  matched: number
  decided: number
  undecided: number
  unsupported: number
  top: { checked: number; unanswered: { address: string; clicks: number | null }[] }
  ready: boolean
}

export const addressSummaryQuery = () =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "urls-summary"],
    queryFn: async () =>
      (await sdk.client.fetch<{ summary: AddressSummary }>("/admin/migrations/urls/summary"))
        .summary,
  })

export type AddressDecision =
  { decision: "auto" | "gone" } | { decision: "redirect"; target: string }

/** The owner's word on an old address; written by the next apply. */
export function useDecideAddress() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...decision }: AddressDecision & { id: string }) =>
      sdk.client.fetch(`/admin/migrations/urls/${encodeURIComponent(id)}/decision`, {
        method: "POST",
        body: decision,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: MIGRATION_KEY }),
  })
}

/** Starts a job about the addresses: the old sitemap read, or the decisions applied (proved again). */
export function useAddressJob() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (
      input:
        | { kind: "sitemap"; url: string }
        | { kind: "apply" }
        | { kind: "search_console"; file: File }
    ): Promise<MigrationJob | { rows: number; addresses: number }> => {
      if (input.kind === "search_console") {
        const response = await fetch("/admin/migrations/urls/search-console", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": input.file.type || "application/octet-stream" },
          body: input.file,
        })
        const data = (await response.json().catch(() => ({}))) as {
          rows?: number
          addresses?: number
          message?: string
        }
        if (!response.ok) {
          throw Object.assign(new Error(data.message ?? "upload failed"), {
            status: response.status,
            message: data.message,
          })
        }
        return { rows: data.rows ?? 0, addresses: data.addresses ?? 0 }
      }
      const path = input.kind === "sitemap" ? "sitemap" : "apply"
      const body = input.kind === "sitemap" ? { url: input.url } : {}
      return withReauth(
        async (extra) =>
          (
            await sdk.client.fetch<{ async_job: MigrationJob }>(`/admin/migrations/urls/${path}`, {
              method: "POST",
              body,
              ...extra,
            })
          ).async_job
      )
    },
    onSuccess: () => client.invalidateQueries({ queryKey: MIGRATION_KEY }),
  })
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
