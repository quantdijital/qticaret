import type { Probe, UsageHealth } from "@/features/monitoring/api"

const probe = (minutes: number, ok: boolean, error: string | null = null): Probe => ({
  checked_at: new Date(Date.UTC(2026, 10, 11, 9, 0) - minutes * 60_000).toISOString(),
  ok,
  status_code: ok ? 200 : error === "health.http_503" ? 503 : null,
  latency_ms: ok ? 42 : null,
  error,
})

/** A running shop near two of its limits, its backend healthy, its storefront down. */
export const USAGE_HEALTH: UsageHealth = {
  usage: {
    reported_at: "2026-11-11T08:58:00.000Z",
    received_at: "2026-11-11T08:58:01.000Z",
    period: "2026-11",
    counts: {
      products: 1650,
      orders_this_month: 10400,
      staff: 2,
      storage_mb: 820,
      llm_credits_this_month: 12,
    },
    last_order_at: "2026-11-11T08:40:00.000Z",
    release: { version: "1.4.0", commit: "0123456789abcdef0123456789abcdef01234567" },
  },
  report: { expected: true, missing: false, missing_after_hours: 3 },
  health: {
    unhealthy_after: 3,
    backend: {
      probed: true,
      standing: {
        state: "healthy",
        consecutive_failures: 0,
        checked_at: "2026-11-11T09:00:00.000Z",
        last_ok_at: "2026-11-11T09:00:00.000Z",
        unhealthy_since: null,
        status_code: 200,
        latency_ms: 42,
        error: null,
      },
      history: [probe(0, true), probe(5, true), probe(10, false, "health.timeout")],
      day: { total: 288, ok: 287 },
    },
    storefront: {
      probed: true,
      standing: {
        state: "unhealthy",
        consecutive_failures: 4,
        checked_at: "2026-11-11T09:00:00.000Z",
        last_ok_at: "2026-11-11T08:40:00.000Z",
        unhealthy_since: "2026-11-11T08:55:00.000Z",
        status_code: 503,
        latency_ms: 30,
        error: "health.http_503",
      },
      history: [probe(0, false, "health.http_503"), probe(5, false, "health.redirect")],
      day: { total: 10, ok: 6 },
    },
  },
}

/** A shop that has never reported nor been probed, but should be reporting. */
export const SILENT: UsageHealth = {
  usage: null,
  report: { expected: true, missing: true, missing_after_hours: 3 },
  health: {
    unhealthy_after: 3,
    backend: { probed: true, standing: null, history: [], day: { total: 0, ok: 0 } },
    storefront: { probed: false, standing: null, history: [], day: { total: 0, ok: 0 } },
  },
}
