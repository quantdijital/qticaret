import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * `GET /admin/integrations/health` (F2.6): each external dependency with a
 * status and a reason code, never an error text. The server keeps a report
 * for 30 seconds, so asking again sooner returns the same one.
 */
export type HealthStatus = "ok" | "down" | "not_configured"

export interface HealthCheck {
  id: string
  /** `cache`, `payment`; shipping and invoicing join in their phases. */
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
