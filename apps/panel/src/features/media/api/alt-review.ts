import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { SheetJob } from "@/features/products/api/sheets"
import type { MediaAsset } from "@/features/media/api/media"
import { MEDIA_KEY } from "@/features/media/api/media"

/**
 * Alt text suggestions in bulk (docs/22 "Aşama 5", PR 5-2): the library's
 * images with no alt text sent to the job `ai.alt_text`, then each
 * suggestion it left reviewed here. "Kullan" is the staff member's own act:
 * it saves the image's alt text and marks the suggestion accepted.
 */

export const ALT_TEXT_TASK = "image_alt_text"
/** Images one job takes; the server refuses more (`IMAGE_ALT_BULK_MAX`). */
export const ALT_BULK_MAX = 50
/** The library's alt text ceiling (`AdminUpdateMedia`); a suggestion itself is at most 125. */
export const ALT_MAX_LENGTH = 250

// What the vision task reads; an SVG never goes
const READABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
// The library read in pages of the server's largest; past this the job is asked for what was found
const PAGE = 100
const MAX_PAGES = 10

export interface OpenAltSuggestion {
  id: string
  service: string
  text: string
  created_at: string
  media: { id: string; url: string; filename: string; alt: string | null }
}

export interface AltJobSummary {
  asked: number
  suggested: number
  refused: number
  failed: number
  skipped: number
  not_asked: number
  stopped: string | null
}

export const ALT_REVIEW_KEY = [...MEDIA_KEY, "alt-review"] as const

export const openAltSuggestionsQuery = () =>
  queryOptions({
    queryKey: ALT_REVIEW_KEY,
    queryFn: async () =>
      (
        await sdk.client.fetch<{ suggestions: OpenAltSuggestion[] }>("/admin/ai/suggestions", {
          query: { task: ALT_TEXT_TASK },
        })
      ).suggestions,
  })

const wantsAlt = (asset: MediaAsset) =>
  !!asset.file_id && READABLE.has(asset.mime_type ?? "") && !(asset.alt ?? "").trim()

/**
 * The newest library images with no alt text, at most `ALT_BULK_MAX`;
 * those already waiting for a decision are left out. The job checks each
 * again on the server.
 */
export async function imagesMissingAlt(waiting: ReadonlySet<string>): Promise<string[]> {
  const found: string[] = []
  for (let page = 0; page < MAX_PAGES && found.length < ALT_BULK_MAX; page++) {
    const { media, count } = await sdk.client.fetch<{ media: MediaAsset[]; count: number }>(
      "/admin/media",
      { query: { offset: page * PAGE, limit: PAGE } }
    )
    for (const asset of media) {
      if (wantsAlt(asset) && !waiting.has(asset.id) && found.length < ALT_BULK_MAX) {
        found.push(asset.id)
      }
    }
    if ((page + 1) * PAGE >= count) {
      break
    }
  }
  return found
}

/** Starts the job; with several services the picked one is named. */
export const startAltJob = async (mediaIds: string[], service?: string) =>
  (
    await sdk.client.fetch<{ async_job: SheetJob }>("/admin/async-jobs", {
      method: "POST",
      body: {
        type: "ai.alt_text",
        input: { media_ids: mediaIds, ...(service ? { service } : {}) },
      },
    })
  ).async_job

/** The image's alt text, saved through the library's own update. */
export async function saveAlt(mediaId: string, alt: string): Promise<void> {
  await sdk.client.fetch(`/admin/media/${encodeURIComponent(mediaId)}`, {
    method: "POST",
    body: { alt },
  })
}
