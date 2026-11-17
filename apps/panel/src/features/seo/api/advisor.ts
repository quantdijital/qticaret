import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The SEO advisor's assessments (docs/14, `/admin/seo/assessments`). */

export type AdvisorKind =
  "product" | "category" | "brand" | "collection" | "page" | "post" | "landing"
export type Grade = "excellent" | "good" | "needs_work" | "poor"
export type Severity = "critical" | "high" | "medium" | "low" | "info"
export type AdvisorCategory = "structured" | "meta" | "images" | "content" | "links" | "technical"

export interface SeoIssue {
  ruleId: string
  severity: Severity
  category: AdvisorCategory
  params: Record<string, string | number>
  fix?: { kind: "auto" | "suggest" | "manual"; action: string }
  /** The AI task that fixes it (backend `lib/ai/registry/advisor-fixes.ts`); absent: none does. */
  ai?: { task: string; field: AdvisorAiField; option?: string }
}

/** Where an AI fix's suggestion goes: the SEO card's two fields, a product's long description. */
export type AdvisorAiField = "seo_title" | "seo_description" | "description"

export interface Assessment {
  score: number
  grade: Grade
  issues: SeoIssue[]
  categories: Partial<Record<AdvisorCategory, number>>
  weights: Record<AdvisorCategory, number>
}

const url = (kind: AdvisorKind, id: string) =>
  `/admin/seo/assessments/${kind}/${encodeURIComponent(id)}`

/** Assessed now; `version` (the page's last change) asks again after a save. */
export const assessmentQuery = (kind: AdvisorKind, id: string, version?: string | null) =>
  queryOptions({
    queryKey: ["seo", "assessment", kind, id, version ?? null],
    queryFn: async () =>
      (await sdk.client.fetch<{ assessment: Assessment }>(url(kind, id))).assessment,
  })

export function useApplyFix(kind: AdvisorKind, id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: string) =>
      sdk.client.fetch<{ assessment: Assessment }>(`${url(kind, id)}/fix`, {
        method: "POST",
        body: { action },
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["seo"] }),
        client.invalidateQueries({ queryKey: ["seo-meta"] }),
        client.invalidateQueries({ queryKey: ["products"] }),
      ])
    },
  })
}

export interface StoredAssessment {
  entity_id: string
  score: number
  grade: Grade
  critical: number
  issues: number
}

/** Scores of the products a list shows. */
export const productScoresQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ["seo", "scores", "product", ids],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ assessments: StoredAssessment[] }>("/admin/seo/assessments", {
          query: { kind: "product", ids: ids.join(","), limit: 100 },
        })
      ).assessments,
    enabled: ids.length > 0,
  })

export interface AdvisorSummary {
  products: number
  average: number | null
  grades: Record<Grade, number>
  critical: number
  lowest: { id: string; title: string; thumbnail: string | null; score: number; grade: Grade }[]
}

export const advisorSummaryQuery = () =>
  queryOptions({
    queryKey: ["seo", "advisor-summary"],
    queryFn: () => sdk.client.fetch<AdvisorSummary>("/admin/seo/assessments/summary"),
  })
