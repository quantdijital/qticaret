import { z } from "@medusajs/framework/zod"
import { IMAGE_BACKGROUNDS } from "../../../lib/ai/registry/services"
import { IMAGE_BACKGROUND_MAX_BATCH, IMAGE_SCENE_MAX_BATCH } from "../../../lib/ai/registry/tasks"
import { SCENE_CODE } from "@qticaret/sector-packs"
import { CUSTOM_SCENE_CODE, SCENE_TEXT_MAX } from "../../../lib/ai/scene-text"
import { isPlanLimitError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { assertStorageFits } from "../../../lib/plan-limits"
import { errorKeyOf } from "../../ai/bulk-alt-text"
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
 * A scene (Aşama 7) by its code (a saved scene's id) only: its
 * description is read from the shop's scenes when the job runs. A scene
 * typed once (`custom`) has no record to read, so its words sit here,
 * cleaned by the route's workflow (`cleanSceneText`: no personal data, no
 * link) and cleaned again before the call. Exactly one of the two.
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
      scene: z.string().regex(SCENE_CODE).optional(),
      custom: z.string().min(1).max(SCENE_TEXT_MAX).optional(),
      media_ids: mediaIds(IMAGE_SCENE_MAX_BATCH),
      ...common,
    })
    .strict()
    .refine((value) => (value.scene === undefined) !== (value.custom === undefined)),
])

/** The option a picture's run is asked with: never a typed scene's words in the summary. */
function optionOf(data: Input) {
  if (data.task !== "image_scene") {
    return { run: { background: data.background }, summary: { background: data.background } }
  }
  return data.custom !== undefined
    ? { run: { custom: data.custom }, summary: { scene: CUSTOM_SCENE_CODE } }
    : { run: { scene: data.scene ?? null }, summary: { scene: data.scene ?? null } }
}

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

/**
 * A refusal that holds for every picture left: the day's or the month's
 * quota, the storage, or what each picture's run checks again before it
 * spends anything (adr/0071 §8.1): the asker's role lowered, the package
 * no longer opening a way to pay, the queued service gone or paid
 * another way, the task or the scene no longer offered (a scene taken
 * out of the shop's packs would fail every picture alike). The picture
 * refused is not counted as failed.
 */
const STOP_KEYS: ReadonlySet<string> = new Set([
  "plan.limit_reached",
  "ai.daily_limit_reached",
  "staff.forbidden",
  "ai.own_keys_not_in_plan",
  "ai.no_service",
  "ai.service_unavailable",
  "ai.unknown_task",
])

function stopKeyOf(error: unknown): string | null {
  if (isPlanLimitError(error)) {
    return "plan.limit_reached"
  }
  const key = errorKeyOf(error)
  return STOP_KEYS.has(key) ? key : null
}

/**
 * `ai.image_edit` (adr/0071 §8): each picture its own call, quota claim
 * and usage row, one after another, each asked as the staff member who
 * queued it (`editImageWorkflow` checks the role, the flags and the
 * service again before every picture). When the quota or the storage runs
 * out, or such a check refuses, the rest are skipped and the job ends
 * with what it did. Results are
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
    const option = optionOf(data)
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
            ...option.run,
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
          // The summary keeps a fixed key only; what went wrong goes to the log, redacted
          logger.warn({ event: "ai.image_edit_picture_failed", err: errorSummary(error) })
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
        ...option.summary,
        done,
        failed,
        skipped: data.media_ids.length - done.length - failed.length,
        stopped_by: stoppedBy,
      },
    }
  },
}
