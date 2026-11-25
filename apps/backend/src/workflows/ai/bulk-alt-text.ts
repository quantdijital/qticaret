import type { MedusaContainer } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { IMAGE_ALT_BULK_MAX, IMAGE_ALT_TEXT_TASK } from "../../lib/ai/registry/tasks"
import { CONTENT_DRAFTS_MODULE } from "../../modules/content-drafts"
import type ContentDraftsModuleService from "../../modules/content-drafts/service"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { errorKeyOf, runBulkSuggestions } from "./bulk-run"
import type { BulkSummary } from "./bulk-run"
import { AI_SUGGESTION_SOURCE } from "./steps/save-suggestion"
import { suggestTextWorkflow } from "./suggest-text"

/**
 * Alt text suggestions for many images at once (adr/0071 §8, docs/22
 * "Aşama 5"): the bulk job `ai.alt_text`. It takes ids only, at most
 * `IMAGE_ALT_BULK_MAX`, and asks for each image that has no alt text and
 * no open suggestion yet, one by one through the same workflow as a single
 * ask: each claims its own quota, writes its own usage row and keeps its
 * own suggestion (`content_draft`, status `draft`). Nothing is written to
 * an image: the suggestions wait to be accepted one by one or together.
 * When the month's or the day's ceiling is reached, or no service can
 * do the work, the job stops and the rest is counted as not asked.
 */

const MEDIA_ID = /^media_[A-Za-z0-9]{1,40}$/
const NAME = /^[a-z][a-z0-9_]{0,39}$/

export const AiAltTextInput = z
  .object({
    media_ids: z.array(z.string().regex(MEDIA_ID)).min(1).max(IMAGE_ALT_BULK_MAX),
    service: z.string().regex(NAME).optional(),
    // Set on the server when queued (never the request's): each item is paid that way or not asked
    funding: z.enum(["own_key", "platform_credit"]).optional(),
  })
  .strict()
export type AiAltTextInput = z.infer<typeof AiAltTextInput>

/** Had an alt text, an open suggestion, or no stored picture: skipped, not asked. */
export type BulkAltTextSummary = BulkSummary

export { errorKeyOf }

export interface BulkAltTextDeps {
  /** The ids worth asking for, in the order given: no alt text, a stored picture, no open suggestion. */
  eligible: (ids: readonly string[]) => Promise<string[]>
  /** Checked again just before each ask: a suggestion made meanwhile (one by hand, a job queued twice) is not asked for twice. */
  waiting: (id: string) => Promise<boolean>
  /** One ask; throws the workflow's error. */
  suggest: (id: string) => Promise<"draft" | "refused">
  progress: (percent: number) => Promise<void>
}

/** The job's loop, apart from Medusa so its limits and its stops are tested on their own. */
export async function runBulkAltText(
  deps: BulkAltTextDeps,
  mediaIds: readonly string[]
): Promise<BulkAltTextSummary> {
  const ids = [...new Set(mediaIds)].slice(0, IMAGE_ALT_BULK_MAX)
  const eligible = await deps.eligible(ids)
  return runBulkSuggestions(
    {
      waiting: deps.waiting,
      suggest: deps.suggest,
      progress: deps.progress,
      failedEvent: "ai.alt_text_image_failed",
    },
    eligible,
    ids.length - eligible.length
  )
}

type Container = Pick<MedusaContainer, "resolve">

// What the media pipeline stores and the vision task reads (lib/ai/facts/media.ts)
const READABLE_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
])

/** Of these images, the ones with an alt text suggestion waiting for a decision. */
async function waitingFor(container: Container, ids: readonly string[]): Promise<Set<string>> {
  const open = await container
    .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    .listContentDrafts(
      {
        entity_id: [...ids],
        kind: IMAGE_ALT_TEXT_TASK.id,
        source: AI_SUGGESTION_SOURCE,
        status: "draft",
      },
      { select: ["entity_id"] }
    )
  return new Set(open.map((draft) => draft.entity_id))
}

/** The images worth asking for: a stored raster picture, no alt text, no suggestion waiting. */
async function eligibleImages(container: Container, ids: readonly string[]): Promise<string[]> {
  const assets = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ id: [...ids] }, { select: ["id", "file_id", "mime_type", "alt"] })
  const waiting = await waitingFor(container, ids)
  const worth = new Set(
    assets
      .filter(
        (asset) =>
          !!asset.file_id &&
          READABLE_TYPES.has(asset.mime_type ?? "") &&
          !(asset.alt ?? "").trim() &&
          !waiting.has(asset.id)
      )
      .map((asset) => asset.id)
  )
  return ids.filter((id) => worth.has(id))
}

/** The job's run with the container: each ask as the staff member who queued it. */
export function bulkAltText(
  container: Container,
  input: AiAltTextInput & { user_id: string },
  progress: (percent: number) => Promise<void>
): Promise<BulkAltTextSummary> {
  return runBulkAltText(
    {
      eligible: (ids) => eligibleImages(container, ids),
      waiting: async (id) => (await waitingFor(container, [id])).has(id),
      suggest: async (id) => {
        const { result } = await suggestTextWorkflow(container as MedusaContainer).run({
          input: {
            task: IMAGE_ALT_TEXT_TASK.id,
            entity_type: "media",
            entity_id: id,
            service: input.service,
            funding: input.funding,
            user_id: input.user_id,
          },
        })
        return result.status
      },
      progress,
    },
    input.media_ids
  )
}
