import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** What Search Console and CrUX said of the shop last (F10.11). */
export interface SeoInsights {
  /** Whether the platform has opened Google: until then no Search Console part is shown. */
  search_console: boolean
  /** Whether the platform reads Chrome's field data (CrUX): until then no Web Vitals part is shown. */
  web_vitals: boolean
  search: {
    period_end: string | null
    clicks: number
    impressions: number
    /** 0–1. */
    ctr: number
    position: number
    prev_clicks: number
    prev_impressions: number
    dropped: { path: string; clicks: number; prev_clicks: number }[]
  } | null
  index: { inspected: number; indexed: number }
  vitals: {
    form_factor: "PHONE" | "DESKTOP"
    has_data: boolean
    lcp_ms: number | null
    inp_ms: number | null
    cls: number | null
    collected_at: string
  }[]
  runs: { kind: string; ran_at: string; error: string | null }[]
}

export const insightsQuery = () =>
  queryOptions({
    queryKey: ["seo", "insights"],
    queryFn: () => sdk.client.fetch<{ insights: SeoInsights }>("/admin/seo/insights"),
  })

/** Asks Search Console and CrUX now, as the night would. */
export function useRefreshInsights() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => sdk.client.fetch("/admin/seo/insights/refresh", { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["seo", "insights"] })
    },
  })
}

/** Google's lines for each Core Web Vital at p75: good up to the first, poor past the second. */
export const VITAL_LINES = {
  lcp_ms: [2500, 4000],
  inp_ms: [200, 500],
  cls: [0.1, 0.25],
} as const

export type VitalKey = keyof typeof VITAL_LINES

export function vitalGrade(key: VitalKey, value: number): "good" | "improve" | "poor" {
  const [good, poor] = VITAL_LINES[key]
  return value <= good ? "good" : value <= poor ? "improve" : "poor"
}
