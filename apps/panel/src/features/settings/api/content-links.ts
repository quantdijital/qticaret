import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import type { AsyncJob } from "@/features/settings/api/activity"
import { sdk } from "@/lib/sdk"

/**
 * The texts' links to the old site pointed at the pages that answer them
 * here (adr/0042 Ek 2026-11-05): a `content.link_rewrite` job, its last
 * run and its report.
 */

export const LINK_JOB = "content.link_rewrite"

export type LinkJob = AsyncJob & { error_message: string | null }

const summarySchema = z.object({
  dry_run: z.boolean(),
  documents: z.number().int().min(0),
  rewritten: z.number().int().min(0),
  changed: z.number().int().min(0),
  unresolved: z.number().int().min(0),
})

export type LinkSummary = z.infer<typeof summarySchema>

/** A finished run's counts, when its summary reads as one. */
export const linkSummaryOf = (job: LinkJob | null | undefined): LinkSummary | null =>
  summarySchema.safeParse(job?.result_summary).data ?? null

export const isRunning = (job: LinkJob | null | undefined): boolean =>
  job?.status === "queued" || job?.status === "running"

const KEY = ["settings", "content-links"] as const

/** The last run, looked at again every two seconds while it runs. */
export const lastLinkJobQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: async () =>
      (
        await sdk.client.fetch<{ async_jobs: LinkJob[] }>("/admin/async-jobs", {
          query: { type: LINK_JOB, limit: 1 },
        })
      ).async_jobs[0] ?? null,
    refetchInterval: (query) => (isRunning(query.state.data) ? 2000 : false),
  })

/** Starts a run: `dry_run` only counts what would change. */
export function useStartLinkRewrite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (dryRun: boolean) =>
      (
        await sdk.client.fetch<{ async_job: LinkJob }>("/admin/async-jobs", {
          method: "POST",
          body: { type: LINK_JOB, input: { dry_run: dryRun } },
        })
      ).async_job,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
