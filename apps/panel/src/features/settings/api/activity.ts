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
