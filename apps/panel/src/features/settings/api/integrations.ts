import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { ACCOUNTS_KEY } from "@/features/settings/api/payments"
import type { AccountCheck } from "@/features/settings/api/payments"
import { sdk } from "@/lib/sdk"

/**
 * `GET /admin/integrations/health` (F2.6): each external dependency with a
 * status and a reason code, never an error text. The server keeps a report
 * for 30 seconds, so asking again sooner returns the same one.
 */
export type HealthStatus = "ok" | "down" | "not_configured"

export interface HealthCheck {
  id: string
  /** `payment`, `shipping`, `messaging`. */
  kind: string
  status: HealthStatus
  reason?: string
  latency_ms: number
}

export interface HealthReport {
  status: "ok" | "degraded"
  checked_at: string
  checks: HealthCheck[]
}

export const integrationHealthQuery = () =>
  queryOptions({
    queryKey: ["settings", "integrations", "health"],
    queryFn: () => sdk.client.fetch<HealthReport>("/admin/integrations/health"),
  })

export type IntegrationGroup = "payments" | "shipping" | "messaging" | "marketing"

export type IntegrationState = "connected" | "attention" | "not_set_up" | "off"

/** A call the provider failed, by its codes only (F12.2). */
export interface ProviderFailure {
  at: string
  code: string
  status: number | null
  method: string
  path: string
  request_id: string | null
}

/** `GET /admin/integrations/overview` (F12.2): one outside service and where it stands. */
export interface IntegrationView {
  id: string
  group: IntegrationGroup
  state: IntegrationState
  notes: { code: string; count?: number }[]
  /** `account`: it can be tested with the stored account. */
  test: "account" | null
  failures: ProviderFailure[]
}

const OVERVIEW_KEY = ["settings", "integrations", "overview"] as const

export const integrationOverviewQuery = () =>
  queryOptions({
    queryKey: OVERVIEW_KEY,
    queryFn: async () =>
      (await sdk.client.fetch<{ integrations: IntegrationView[] }>("/admin/integrations/overview"))
        .integrations,
  })

/** "Test the connection" with the stored account; the page, the accounts and the health refresh. */
export function useTestIntegration() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ check: AccountCheck | null }>(
        `/admin/integrations/credentials/${encodeURIComponent(id)}/check`,
        { method: "POST", body: {} }
      ),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: OVERVIEW_KEY }),
        client.invalidateQueries({ queryKey: ["settings", "integrations", "health"] }),
        client.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
      ])
    },
  })
}
