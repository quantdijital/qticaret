import { z } from "@medusajs/framework/zod"
import { IMAGE_BACKGROUNDS } from "../../../lib/ai/registry/services"
import { IMAGE_BACKGROUND_MAX_BATCH, IMAGE_SCENE_MAX_BATCH } from "../../../lib/ai/registry/tasks"
import { SCENE_CODE } from "@qticaret/sector-packs"
import { isPlanLimitError, isValidationError } from "../../../lib/errors"
import { assertStorageFits } from "../../../lib/plan-limits"
import { editImageWorkflow } from "../../ai/edit-image"
import { STORAGE_FULL } from "../../ai/steps/edit-image"
import type { JobType } from "./types"

/** A media record's id; checked to exist and to be a raster master by the route's workflow. */
export const MEDIA_ID = /^media_[A-Za-z0-9]{1,40}$/

/**
 * What the route queued (Aşama 4): the task, the service it chose, the
 * background, the pictures. Identifiers only (adr/0071 §8); who asked is
 * the job's own `requested_by`, never a field of the input.
 */
const mediaIds = (max: number) =>
  z
    .array(z.string().regex(MEDIA_ID))
    .min(1)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length)

const common = {
  service: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  funding: z.enum(["own_key", "platform_credit"]),
  remember: z.boolean(),
}

/**
 * A scene (Aşama 7) by its code only: its description is read from the
 * shop's packs when the job runs, so a prompt never sits in a job's input.
 */
const input = z.discriminatedUnion("task", [
  z
    .object({
      task: z.literal("image_background"),
      background: z.enum(IMAGE_BACKGROUNDS),
      media_ids: mediaIds(IMAGE_BACKGROUND_MAX_BATCH),
      ...common,
    })
    .strict(),
  z
    .object({
      task: z.literal("image_scene"),
      scene: z.string().regex(SCENE_CODE),
      media_ids: mediaIds(IMAGE_SCENE_MAX_BATCH),
      ...common,
    })
    .strict(),
])

type Input = z.infer<typeof input>

interface Done {
  media_id: string
  result_id: string
  suggestion_id: string | null
}

interface Failed {
  media_id: string
  key: string
}

/** A refusal that holds for every picture left: the day's or the month's quota, the storage. */
function stopKeyOf(error: unknown): string | null {
  if (isPlanLimitError(error)) {
    return "plan.limit_reached"
  }
  if (isValidationError(error) && error.safeMessage === "ai.daily_limit_reached") {
    return "ai.daily_limit_reached"
  }
  return null
}

/**
 * `ai.image_edit` (adr/0071 §8): each picture its own call, quota claim
 * and usage row, one after another. When the quota or the storage runs
 * out the rest are skipped and the job ends with what it did. Results are
 * suggestions: nothing reaches a product here (docs/22 PR 4-2).
 */
export const aiImageEdit: JobType<Input> = {
  input,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  managersOnly: true,
  internal: true,
  execute: async ({ container, job, progress }, data) => {
    const userId = job.requested_by
    if (!userId) {
      throw new Error("ai.image_edit: queued by nobody")
    }
    const option =
      data.task === "image_scene" ? { scene: data.scene } : { background: data.background }
    const done: Done[] = []
    const failed: Failed[] = []
    let stoppedBy: string | null = null
    for (const [index, mediaId] of data.media_ids.entries()) {
      try {
        // Full already: no call the shop would pay for and could not keep
        await assertStorageFits(container, 0)
        const { result } = await editImageWorkflow(container).run({
          input: {
            task: data.task,
            service: data.service,
            funding: data.funding,
            ...option,
            media_id: mediaId,
            user_id: userId,
            remember: data.remember && index === 0,
          },
        })
        if (result.status === "succeeded" && result.media_id) {
          done.push({
            media_id: mediaId,
            result_id: result.media_id,
            suggestion_id: result.suggestion_id,
          })
        } else if (result.error_code === STORAGE_FULL) {
          failed.push({ media_id: mediaId, key: "plan.limit_reached" })
          stoppedBy = "plan.limit_reached"
        } else {
          failed.push({
            media_id: mediaId,
            key: result.error_key ?? "ai.provider_response_invalid",
          })
        }
      } catch (error) {
        stoppedBy = stopKeyOf(error)
        if (stoppedBy === null) {
          failed.push({ media_id: mediaId, key: "ai.provider_response_invalid" })
        }
      }
      await progress(((index + 1) / data.media_ids.length) * 100)
      if (stoppedBy !== null) {
        break
      }
    }
    return {
      summary: {
        task: data.task,
        service: data.service,
        ...option,
        done,
        failed,
        skipped: data.media_ids.length - done.length - failed.length,
        stopped_by: stoppedBy,
      },
    }
  },
}
