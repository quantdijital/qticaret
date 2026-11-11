import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { tenantKey, tenantPath } from "@/features/tenants/api"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"

/**
 * A shop's setup runs (adr/0061 §6, Ek C10) as the control plane answers
 * them: ids, statuses, codes and the steps' non-secret outputs (a port, a
 * serial, a duration). No secret, link or address is ever in a run.
 */

export type RunKind = "create" | "start" | "stop" | "invite" | "apply_pack" | (string & {})
export type RunStatus = "running" | "succeeded" | "failed"
export type StepStatus = "pending" | "running" | "succeeded" | "skipped" | "failed" | "compensated"

export interface RunStep {
  name: string
  position: number
  status: StepStatus
  attempts: number
  /** Whether this run made something (undone on a failure). */
  created: boolean
  /** A failure's code, or a warning's on a step that went (an invite not mailed). */
  error_code: string | null
  output: Record<string, unknown> | null
  started_at: string | null
  finished_at: string | null
}

export interface Run {
  id: string
  kind: RunKind
  status: RunStatus
  provider: "local" | "docker" | "fake" | (string & {})
  requested_by: string | null
  port: number | null
  error_code: string | null
  started_at: string
  finished_at: string | null
  /** The latest run's and one asked for by id. */
  steps?: RunStep[]
}

export interface ProvisioningState {
  /** This control plane's provisioner; null: nothing can be started here. */
  provisioner: "local" | "docker" | "fake" | (string & {}) | null
  latest: Run | null
  runs: Run[]
}

/** While a run goes, its steps are read every two seconds (and not while the tab is hidden). */
export const POLL_MS = 2_000

export const provisioningKey = (id: string) => ["tenants", "provisioning", id] as const

/** Polls while the latest run is under way; stops once it ends. */
export const pollInterval = (state: ProvisioningState | undefined): number | false =>
  state?.latest?.status === "running" ? POLL_MS : false

export const provisioningQuery = (id: string) =>
  queryOptions({
    queryKey: provisioningKey(id),
    queryFn: () => api<ProvisioningState>(tenantPath(id, "/provisioning")),
    refetchInterval: (query) => pollInterval(query.state.data),
    // A hidden browser tab asks nothing (TanStack Query's default, said here on purpose)
    refetchIntervalInBackground: false,
  })

/** One run in full (the history's dialog). */
export const runQuery = (id: string, runId: string) =>
  queryOptions({
    queryKey: [...provisioningKey(id), "run", runId],
    queryFn: () =>
      api<{ run: Run }>(tenantPath(id, `/provisioning/runs/${encodeURIComponent(runId)}`)),
  })

export type RunAction = "create" | "stop" | "start" | "invite" | "apply_pack"

const ACTION_PATHS: Record<RunAction, string> = {
  create: "/provisioning",
  stop: "/provisioning/stop",
  start: "/provisioning/start",
  invite: "/provisioning/invite",
  // C12: the shop's sector pack again (only what it never had)
  apply_pack: "/provisioning/apply-pack",
}

/** Starts a run (owner, operator); each acts outside the control plane, so each asks a step-up. */
export const startRun = (id: string, action: RunAction) =>
  withStepUp((headers) =>
    api<{ run: Run }>(tenantPath(id, ACTION_PATHS[action]), { method: "POST", body: {}, headers })
  )

export function useRunAction(id: string) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: (action: RunAction) => startRun(id, action),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: provisioningKey(id) })
      await client.invalidateQueries({ queryKey: tenantKey(id) })
    },
  })
}
