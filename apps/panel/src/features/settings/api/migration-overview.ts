import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { MIGRATION_KEY } from "@/features/settings/api/migration"
import type { MigrationJob, MigrationRun } from "@/features/settings/api/migration"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/**
 * The migration page's summary, a run's live step and its problems
 * (adr/0042 Ek 2026-11-27): what the server counts, read as the panel
 * shows it; anything unexpected reads as nothing.
 */

/** What a run may be asked to move, in the run's order (the server's `RUN_KINDS`). */
export const RUN_KIND_NAMES = [
  "category",
  "brand",
  "product",
  "image",
  "customer",
  "order",
  "review",
  "post",
  "page",
  "url",
] as const
export type RunKindName = (typeof RUN_KIND_NAMES)[number]

/** What a kind cannot do without; the server adds it too. */
export const KIND_NEEDS: Readonly<Partial<Record<RunKindName, readonly RunKindName[]>>> = {
  product: ["category", "brand"],
  image: ["product"],
  review: ["product"],
  order: ["customer"],
}

/** The kinds the chosen ones need, by the kinds needing them (a locked box says why). */
export function neededBy(chosen: ReadonlySet<RunKindName>): Map<RunKindName, RunKindName> {
  const needed = new Map<RunKindName, RunKindName>()
  const visit = (kind: RunKindName, by: RunKindName) => {
    for (const need of KIND_NEEDS[kind] ?? []) {
      if (!needed.has(need)) {
        needed.set(need, by)
        visit(need, by)
      }
    }
  }
  chosen.forEach((kind) => {
    visit(kind, kind)
  })
  return needed
}

/** The completions (refresh.ts on the server). */
export const REFRESH_KINDS = [
  "images",
  "descriptions",
  "summaries",
  "post_images",
  "category_covers",
] as const
export type RefreshKind = (typeof REFRESH_KINDS)[number]

const count = z.number().int().min(0)

const overviewSchema = z.object({
  last_run: z
    .object({
      id: z.string(),
      source: z.string(),
      status: z.string(),
      job_id: z.string().nullable(),
      created_at: z.string(),
      finished_at: z.string().nullable(),
    })
    .nullable(),
  sources: z.array(z.string()),
  kinds: z.record(z.string(), z.object({ moved: count, problems: count })),
  missing: z.object({
    images: count,
    post_images: count,
    summaries: count,
    category_covers: count,
    urls: count,
    descriptions: count,
  }),
  addresses: z.object({ total: count, undecided: count }),
})
export type MigrationOverview = z.infer<typeof overviewSchema>

/** The platform the shop's products came from, by the sources records moved from. */
export function productSourceOf(
  overview: MigrationOverview | undefined
): "wordpress" | "shopify" | "feed" | null {
  for (const kind of ["wordpress", "shopify", "feed"] as const) {
    if (overview?.sources.some((source) => source === kind || source.startsWith(`${kind}:`))) {
      return kind
    }
  }
  return null
}

export const migrationOverviewQuery = () =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "overview"],
    queryFn: async () =>
      overviewSchema.parse(
        (await sdk.client.fetch<{ overview: unknown }>("/admin/migrations/overview")).overview
      ),
  })

const phaseSchema = z.object({
  kinds: z.array(z.string()),
  kind: z.string(),
  done: count,
  total: count,
})
export type RunPhase = z.infer<typeof phaseSchema>

/** The run's live step, when it keeps one. */
export const phaseOf = (run: MigrationRun | null | undefined): RunPhase | null =>
  phaseSchema.safeParse((run?.counts as Record<string, unknown> | undefined)?.["_phase"]).data ??
  null

/** The run a job is moving, looked at again while the job runs. */
export const runOfJobQuery = (jobId: string | null, running: boolean) =>
  queryOptions({
    queryKey: [...MIGRATION_KEY, "run-of", jobId],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ runs: MigrationRun[] }>(
          `/admin/migrations?job_id=${encodeURIComponent(jobId ?? "")}`
        )
      ).runs[0] ?? null,
    enabled: jobId !== null,
    refetchInterval: running ? 1500 : false,
  })

const problemSchema = z.object({
  kind: z.string(),
  key: z.string(),
  count,
  samples: z.array(z.string()),
  message: z.string().optional(),
})
export type ProblemGroup = z.infer<typeof problemSchema>

const summarySchema = z.object({
  mode: z.enum(["check", "apply"]),
  counts: z.record(z.string(), z.record(z.string(), z.number())),
  kinds: z.array(z.enum(RUN_KIND_NAMES)).optional(),
  added_kinds: z.array(z.enum(RUN_KIND_NAMES)).optional(),
  refresh: z.array(z.string()).optional(),
  problems: z.array(problemSchema).optional(),
})
export type RunSummary = z.infer<typeof summarySchema>

/** A finished run's summary as the panel reads it, or null. */
export const runSummaryOf = (job: MigrationJob | null | undefined): RunSummary | null =>
  job?.status === "succeeded" ? (summarySchema.safeParse(job.result_summary).data ?? null) : null

/** Every moved record's old address tied to its new page again (301); the owner proves it again. */
export function useRebuildAddresses() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      withReauth(
        async (extra) =>
          (
            await sdk.client.fetch<{ async_job: MigrationJob }>("/admin/migrations/urls/rebuild", {
              method: "POST",
              body: {},
              ...extra,
            })
          ).async_job
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: MIGRATION_KEY }),
  })
}

/** The old addresses and where each goes now, as CSV: downloaded by the browser. */
export const URL_EXPORT_PATH = "/admin/migrations/urls/export"
