import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { MIGRATION_KEY } from "@/features/settings/api/migration"
import type { MigrationJob } from "@/features/settings/api/migration"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** The old site's addresses and their 301s (F14.7, adr/0042): the inventory, the owner's words, the jobs. */

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
