import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { AsyncJob } from "./activity"

/** The address reference data (adr/0008 Ek 2026-11-04): il, ilçe, mahalle and köy from TürkiyeAPI. */

export interface LevelCounts {
  created: number
  updated: number
  deactivated: number
  unchanged: number
}

/** A sync job's report (`result_summary`). */
export interface AddressDataReport {
  skipped: boolean
  source: "turkiyeapi" | "file"
  dataset_version: string | null
  last_updated: string | null
  provinces: LevelCounts | null
  districts: LevelCounts | null
  neighborhoods: LevelCounts | null
  rejected: number
}

export type AddressDataJob = AsyncJob & {
  progress_key: string | null
  error_message: string | null
}

export interface AddressDataStatus {
  provinces: number
  districts: number
  /** Neighbourhoods and villages together, as the address forms list them. */
  neighborhoods: number
  villages: number
  source: "turkiyeapi" | "file" | null
  /** TürkiyeAPI's dataset version ("2025") and its date ("2026-05-21"). */
  dataset_version: string | null
  last_updated: string | null
  last_sync_at: string | null
  /** The newest sync job, running or done. */
  job: AddressDataJob | null
}

export const ADDRESS_DATA_KEY = ["settings", "address-data"] as const

export const isRunning = (job: AsyncJob | null | undefined): boolean =>
  job?.status === "queued" || job?.status === "running"

/** `GET /admin/tr-address/status`, looked at every second while a sync runs. */
export const addressDataQuery = () =>
  queryOptions({
    queryKey: ADDRESS_DATA_KEY,
    queryFn: () => sdk.client.fetch<AddressDataStatus>("/admin/tr-address/status"),
    refetchInterval: (query) => (isRunning(query.state.data?.job) ? 1000 : false),
  })

/** Starts a sync from TürkiyeAPI (the owner's): a job, one at a time. */
export function useSyncAddressData() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ async_job: AddressDataJob }>("/admin/tr-address/sync", {
        method: "POST",
        body: {},
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ADDRESS_DATA_KEY })
    },
  })
}

/** What a report changed, all levels together. */
export function reportTotals(report: AddressDataReport) {
  const levels = [report.provinces, report.districts, report.neighborhoods]
  const sum = (field: keyof LevelCounts) =>
    levels.reduce((total, level) => total + (level?.[field] ?? 0), 0)
  return { added: sum("created"), updated: sum("updated"), removed: sum("deactivated") }
}
