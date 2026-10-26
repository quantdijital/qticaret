import { queryOptions } from "@tanstack/react-query"
import type { SheetJob } from "@/features/products/api/sheets"
import { sdk } from "@/lib/sdk"

/** Batches of single-use codes (F4.6, ADR-0024): what the shop made from a promotion. */

export const MAX_CODES = 10_000

export interface CodeBatch {
  campaign_id: string
  /** When its codes stop working; past once it ended or was stopped. */
  ends_at: string | null
  created_at: string
  count: number
  used: number
}

export const codeBatchesQuery = (promotionId: string) =>
  queryOptions({
    queryKey: ["promotions", "code-batches", promotionId],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ batches: CodeBatch[] }>(
          `/admin/promotions/${encodeURIComponent(promotionId)}/code-batches`
        )
      ).batches,
  })

/** A batch's codes as a CSV, each with whether it was used; the session cookie signs the link. */
export const batchCodesUrl = (promotionId: string, campaignId: string) =>
  `/admin/promotions/${encodeURIComponent(promotionId)}/code-batches/${encodeURIComponent(campaignId)}/codes`

/** A batch's codes stopped: its campaign ends now (a leaked batch, a campaign called off). */
export const revokeCodeBatch = (promotionId: string, campaignId: string) =>
  sdk.client.fetch(
    `/admin/promotions/${encodeURIComponent(promotionId)}/code-batches/${encodeURIComponent(campaignId)}/revoke`,
    { method: "POST", body: {} }
  )

/** Starts a batch: a job the panel follows (`sheetJobQuery`) until its codes are written. */
export const startCodeBatch = async (promotionId: string, count: number): Promise<SheetJob> =>
  (
    await sdk.client.fetch<{ async_job: SheetJob }>("/admin/async-jobs", {
      method: "POST",
      body: { type: "promotion.codes", input: { promotion_id: promotionId, count } },
    })
  ).async_job

/** "250" → 250; anything not a whole number from 1 to 10,000 is null. */
export function codeCountOf(text: string): number | null {
  const count = /^\d{1,5}$/u.test(text.trim()) ? Number(text.trim()) : Number.NaN
  return Number.isInteger(count) && count >= 1 && count <= MAX_CODES ? count : null
}
