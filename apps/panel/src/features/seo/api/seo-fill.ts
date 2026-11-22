import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { SeoEntityType } from "@/features/seo/api/seo-meta"
import { DESCRIPTION_LIMIT, SEO_MAX, TITLE_LIMIT } from "@/features/seo/components/seo-limits"

/**
 * Filling the missing search texts in bulk (adr/0074 §5 madde 7): the
 * server picks the pages from the advisor's findings and queues the job;
 * each suggestion it leaves is reviewed here. "Kullan" is the person's own
 * act: the page's SEO save, then the suggestion marked accepted with the
 * candidate taken. Nothing reaches a page otherwise.
 */

export const SEO_FILL_KEY = ["seo", "ai-fill"] as const

/** What to fill: both by default, the others behind "Seçenekler". */
export const SEO_FILL_SCOPES = ["both", "title", "description"] as const
export type SeoFillScope = (typeof SEO_FILL_SCOPES)[number]

export type SeoFillTask = "seo_title" | "seo_description"

export interface SeoFillCount {
  /** Pages with a finding a search text closes and no suggestion waiting. */
  pages: number
  title: number
  description: number
  /** The server stopped counting at its cap: the totals read "5000+". */
  capped?: boolean
  /** Pages one job takes. */
  max: number
}

export interface OpenSeoSuggestion {
  id: string
  task: SeoFillTask
  service: string
  candidates: string[]
  created_at: string
  entity: { type: SeoEntityType; id: string; name: string; current: string | null }
}

export interface SeoFillSummary {
  pages: number
  asked: number
  suggested: number
  refused: number
  failed: number
  skipped: number
  not_asked: number
  stopped: string | null
}

export const seoFillCountQuery = () =>
  queryOptions({
    queryKey: [...SEO_FILL_KEY, "count"],
    queryFn: () => sdk.client.fetch<SeoFillCount>("/admin/ai/seo-fill"),
  })

export const openSeoSuggestionsQuery = () =>
  queryOptions({
    queryKey: [...SEO_FILL_KEY, "open"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ suggestions: OpenSeoSuggestion[] }>(
          "/admin/ai/seo-fill/suggestions"
        )
      ).suggestions,
  })

/** Queues the job; with several services the picked one is named. */
export const startSeoFill = async (scope: SeoFillScope, service?: string) =>
  (
    await sdk.client.fetch<{ job_id: string; pages: number; asks: number }>("/admin/ai/seo-fill", {
      method: "POST",
      body: { scope, ...(service ? { service } : {}) },
    })
  ).job_id

/** The page's own SEO save (adr/0015), the field the suggestion is for only. */
export async function saveSeoText(
  type: SeoEntityType,
  id: string,
  task: SeoFillTask,
  text: string
): Promise<void> {
  await sdk.client.fetch(`/admin/seo/${type}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { [task]: text },
  })
}

/** What the field takes and what search results show (the SEO card's own limits). */
export const SEO_FILL_LIMITS: Readonly<Record<SeoFillTask, { max: number; shown: number }>> = {
  seo_title: { max: SEO_MAX.title, shown: TITLE_LIMIT },
  seo_description: { max: SEO_MAX.description, shown: DESCRIPTION_LIMIT },
}

/** The pages the scope reaches, all of them; one job takes `max`. */
export function scopeTotal(count: SeoFillCount | undefined, scope: SeoFillScope): number {
  if (!count) {
    return 0
  }
  return scope === "title" ? count.title : scope === "description" ? count.description : count.pages
}
