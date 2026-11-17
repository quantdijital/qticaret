import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { afterFailure } from "../../../lib/media/video/transcode-errors"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { ClaimedVideo } from "../../../modules/media/service"
import { isLockBusy } from "../../pricing/price-history"
import { removeFiles } from "../files"
import { processVideo } from "./process"
import type { ProcessOutcome } from "./process"

/**
 * The transcoding job's steps (adr/0069 §4): the shop's one lock, the
 * oldest waiting clip taken, the clip made, the outcome written, the
 * source removed. Each step that writes to storage or moves the record
 * undoes itself when a later one fails.
 */

/** The shop-wide lock: one clip at a time in the shop, whichever process runs it. */
export const VIDEO_QUEUE_LOCK = "media:video"
// Held on by the heartbeat (every 30 s); a process that died lets it go within two minutes
const LOCK_EXPIRE_S = 120

const media = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(MEDIA_MODULE) as MediaModuleService

const locking = (container: MedusaContainer) => container.resolve(Modules.LOCKING)

const lockHeld = (error: unknown): boolean =>
  isLockBusy(error) || (error as { type?: unknown } | null)?.type === MedusaError.Types.CONFLICT

/** Holds the lock (again) as `owner`: the same owner refreshes its expiry. */
export const holdVideoQueue = (container: MedusaContainer, owner: string) =>
  locking(container).acquire(VIDEO_QUEUE_LOCK, { ownerId: owner, expire: LOCK_EXPIRE_S })

/**
 * The lock taken at once, or null: another process (or this one) is
 * working the queue, and this run leaves (adr/0069 §4: "alamazsa çıkar").
 * Not `acquireLockStep`: that one waits and then fails the workflow, and
 * its lock cannot be held on past its ttl while a clip takes minutes.
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
      await locking(container).release(VIDEO_QUEUE_LOCK, { ownerId: owner })
    }
  }
)

/** The lock let go, the workflow's last step. */
export const releaseVideoQueueStep = createStep(
  "media-video-release-queue",
  async (owner: string | null, { container }) => {
    if (owner) {
      await locking(container).release(VIDEO_QUEUE_LOCK, { ownerId: owner })
    }
    return new StepResponse(null)
  }
)

/**
 * The oldest `uploaded` clip, now `processing` (none of `exclude`: those
 * this run already tried). Undone as a failed try (an infrastructure one):
 * back to the queue, or failed past its tries.
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
      await media(container).markVideoTried(video.id, next)
    }
  }
)

/** The clip made and stored (`processVideo`); undone by removing what was stored. */
export const transcodeVideoStep = createStep(
  "media-video-transcode",
  async (input: { owner: string | null; video: ClaimedVideo | null }, { container }) => {
    const { owner, video } = input
    if (!owner || !video) {
      return new StepResponse<ProcessOutcome | null, string[]>(null, [])
    }
    const outcome = await processVideo(container, video, {
      keepLock: async () => {
        await holdVideoQueue(container, owner)
      },
    })
    return new StepResponse<ProcessOutcome | null, string[]>(
      outcome,
      outcome.ok ? outcome.fileIds : []
    )
  },
  async (fileIds, { container }) => {
    if (fileIds && fileIds.length > 0) {
      await removeFiles(container, fileIds)
    }
  }
)

export interface SettledVideo {
  id: string
  status: "ready" | "uploaded" | "failed" | "gone"
  source_file_id: string | null
}

/**
 * The outcome written while the video is still the job's: `ready` with its
 * outputs, or a failed try (`afterFailure`: an input error fails now, an
 * infrastructure one is tried three times). A video removed meanwhile has
 * its new files removed and is left alone. Undone by taking `ready` back.
 */
export const settleVideoStep = createStep(
  "media-video-settle",
  async (input: { video: ClaimedVideo | null; outcome: ProcessOutcome | null }, { container }) => {
    const { video, outcome } = input
    if (!video || !outcome) {
      return new StepResponse<SettledVideo | null, string | null>(null, null)
    }
    const settled = (status: SettledVideo["status"]) => ({
      id: video.id,
      status,
      source_file_id: video.source_file_id,
    })
    if (outcome.ok) {
      if (await media(container).markVideoReady(video.id, outcome.ready)) {
        logger.info({ event: "media.video_ready", video_id: video.id })
        return new StepResponse<SettledVideo | null, string | null>(settled("ready"), video.id)
      }
      await removeFiles(container, outcome.fileIds)
      return new StepResponse<SettledVideo | null, string | null>(settled("gone"), null)
    }
    if ("gone" in outcome) {
      return new StepResponse<SettledVideo | null, string | null>(settled("gone"), null)
    }
    const next = afterFailure(video.attempts, outcome.failure)
    const written = await media(container).markVideoTried(video.id, next)
    return new StepResponse<SettledVideo | null, string | null>(
      settled(written ? next.status : "gone"),
      null
    )
  },
  async (readyId, { container }) => {
    if (readyId) {
      await media(container).unmarkVideoReady(readyId)
    }
  }
)

/**
 * A ready video's source goes (adr/0069 §1: it holds the place and the
 * device; it counts against storage). The last step: it never fails;
 * storage refusing, the record keeps naming it and the nightly sweep
 * tries again.
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
