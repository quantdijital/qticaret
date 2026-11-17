import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { afterFailure } from "../../../lib/media/video/transcode-errors"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { ClaimedVideo } from "../../../modules/media/service"
import { removeFiles } from "../files"
import { processVideo } from "./process"
import type { ProcessOutcome } from "./process"
import { holdVideoQueue, lockHeld, releaseVideoQueue } from "./queue-lock"

/**
 * The transcoding job's steps (adr/0069 §4): the shop's one lock, the
 * oldest waiting clip taken, the clip made, the outcome written, the lock
 * let go, the source removed. Each step that writes to storage or moves
 * the record undoes itself when a later one fails; the last two never fail.
 */

const media = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(MEDIA_MODULE) as MediaModuleService

/**
 * The lock taken at once, or null: another process (or this one) is
 * working the queue, and this run leaves (adr/0069 §4: "alamazsa çıkar").
 * Not `acquireLockStep`: that one waits and then fails the workflow, and
 * its lock cannot be held on past its ttl while a clip takes minutes.
 * Undone by letting it go, which never throws (review M1).
 */
export const takeVideoQueueStep = createStep(
  "media-video-take-queue",
  async (_: undefined, { container }) => {
    const owner = `video-job-${randomUUID()}`
    try {
      await holdVideoQueue(container, owner)
    } catch (error) {
      if (!lockHeld(error)) {
        logger.warn({ event: "media.video_queue_lock_failed", err: errorSummary(error) })
      }
      return new StepResponse<string | null, string | null>(null, null)
    }
    return new StepResponse<string | null, string | null>(owner, owner)
  },
  async (owner, { container }) => {
    if (owner) {
      await releaseVideoQueue(container, owner)
    }
  }
)

/** The lock let go; never throws (review M1): a store that is down leaves it to expire. */
export const releaseVideoQueueStep = createStep(
  "media-video-release-queue",
  async (owner: string | null, { container }) => {
    if (owner) {
      await releaseVideoQueue(container, owner)
    }
    return new StepResponse(null)
  }
)

/**
 * The oldest `uploaded` clip, now `processing` (none of `exclude`: those
 * this run already tried). Undone as a failed try (an infrastructure one):
 * back to the queue, or failed past its tries; only while the claim holds.
 */
export const claimNextVideoStep = createStep(
  "media-video-claim",
  async (input: { owner: string | null; exclude: string[] }, { container }) => {
    if (!input.owner) {
      return new StepResponse<ClaimedVideo | null, ClaimedVideo | null>(null, null)
    }
    const video = await media(container).claimNextVideo(input.exclude)
    return new StepResponse<ClaimedVideo | null, ClaimedVideo | null>(video, video)
  },
  async (video, { container }) => {
    if (video) {
      const next = afterFailure(video.attempts, { kind: "infra", code: "" })
      await media(container).markVideoTried(video.id, video.attempts, next)
    }
  }
)

/**
 * Stored outputs a failed workflow leaves (review M1): removed unless the
 * record holds them as `ready` (then they are the video, served). A record
 * that cannot be read keeps them: a stray file is the lesser harm.
 */
export async function removeUnheldOutputs(
  container: MedusaContainer,
  videoId: string,
  fileIds: readonly string[]
): Promise<boolean> {
  if (fileIds.length === 0) {
    return false
  }
  let held: boolean
  try {
    const now = await media(container).videoFiles(videoId)
    const named = new Set([...(now?.output_file_ids ?? []), ...(now?.poster_file_ids ?? [])])
    held =
      now !== null && !now.removed && now.status === "ready" && fileIds.some((id) => named.has(id))
  } catch (error) {
    logger.warn({ event: "media.video_outputs_not_checked", err: errorSummary(error) })
    return false
  }
  if (held) {
    return false
  }
  await removeFiles(container, fileIds)
  return true
}

/** The clip made and stored (`processVideo`); undone by removing what no ready record holds. */
export const transcodeVideoStep = createStep(
  "media-video-transcode",
  async (input: { owner: string | null; video: ClaimedVideo | null }, { container }) => {
    const { owner, video } = input
    if (!owner || !video) {
      return new StepResponse<ProcessOutcome | null, { id: string; files: string[] } | null>(
        null,
        null
      )
    }
    const outcome = await processVideo(container, video, {
      keepLock: async () => {
        await holdVideoQueue(container, owner)
      },
    })
    return new StepResponse<ProcessOutcome | null, { id: string; files: string[] } | null>(
      outcome,
      outcome.ok ? { id: video.id, files: outcome.fileIds } : null
    )
  },
  async (made, { container }) => {
    if (made) {
      await removeUnheldOutputs(container, made.id, made.files)
    }
  }
)

export interface SettledVideo {
  id: string
  status: "ready" | "uploaded" | "failed" | "gone"
  source_file_id: string | null
}

type Settled = StepResponse<SettledVideo | null, string | null>

/**
 * The outcome written while the claim holds (fenced by its `attempts`):
 * `ready` with its outputs, or a failed try (`afterFailure`: an input
 * error fails now, an infrastructure one is tried three times). A video
 * removed or swept back meanwhile has the new files removed and is left
 * alone. Undone by taking `ready` back while the source is still there.
 */
export const settleVideoStep = createStep(
  "media-video-settle",
  async (
    input: { video: ClaimedVideo | null; outcome: ProcessOutcome | null },
    { container }
  ): Promise<Settled> => {
    const { video, outcome } = input
    if (!video || !outcome) {
      return new StepResponse(null, null)
    }
    const settled = (status: SettledVideo["status"]) => ({
      id: video.id,
      status,
      source_file_id: video.source_file_id,
    })
    if (outcome.ok) {
      if (await media(container).markVideoReady(video.id, video.attempts, outcome.ready)) {
        logger.info({ event: "media.video_ready", video_id: video.id })
        return new StepResponse(settled("ready"), video.id)
      }
      await removeFiles(container, outcome.fileIds)
      return new StepResponse(settled("gone"), null)
    }
    if ("gone" in outcome) {
      return new StepResponse(settled("gone"), null)
    }
    const next = afterFailure(video.attempts, outcome.failure)
    const written = await media(container).markVideoTried(video.id, video.attempts, next)
    return new StepResponse(settled(written ? next.status : "gone"), null)
  },
  async (readyId, { container }) => {
    if (readyId) {
      await media(container).unmarkVideoReady(readyId)
    }
  }
)

/**
 * A ready video's source goes (adr/0069 §1: it holds the place and the
 * device; it counts against storage). The workflow's very last step, after
 * the lock and the event (review M1): nothing after it can undo `ready`,
 * and it never fails; storage refusing, the record keeps naming it and the
 * nightly sweep tries again.
 */
export const removeVideoSourceStep = createStep(
  "media-video-remove-source",
  async (settled: SettledVideo | null, { container }) => {
    if (settled?.status !== "ready" || !settled.source_file_id) {
      return new StepResponse(false)
    }
    if (!(await removeFiles(container, [settled.source_file_id]))) {
      logger.warn({ event: "media.video_source_kept", video_id: settled.id })
      return new StepResponse(false)
    }
    try {
      await media(container).forgetVideoSource(settled.id)
    } catch (error) {
      logger.warn({ event: "media.video_source_not_forgotten", err: errorSummary(error) })
    }
    return new StepResponse(true)
  }
)
