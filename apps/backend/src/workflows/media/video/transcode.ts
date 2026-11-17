import type { MedusaContainer } from "@medusajs/framework/types"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../../lib/logging"
import { MAX_ATTEMPTS, STALE_AFTER_MS } from "../../../lib/media/video/limits"
import { PROCESSING_FAILED } from "../../../lib/media/video/transcode-errors"
import { videoTools } from "../../../lib/media/video/tools"
import { forgetUsage } from "../../../lib/plan-limits"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import {
  claimNextVideoStep,
  releaseVideoQueueStep,
  removeVideoSourceStep,
  settleVideoStep,
  takeVideoQueueStep,
  transcodeVideoStep,
} from "./transcode-steps"

/** Emitted when a clip's outputs and poster are stored: `{ id }` (adr/0069 §4 step 8). */
export const MEDIA_VIDEO_READY = "media.video_ready"

export interface TranscodeNextResult {
  /** Another run holds the queue: this one did nothing. */
  busy: boolean
  /** The clip taken, or null when none waited. */
  video_id: string | null
  status: "ready" | "uploaded" | "failed" | "gone" | null
}

/**
 * One clip off the queue (adr/0069 §4): the shop-wide lock (`media:video`)
 * taken at once or the run leaves; the oldest `uploaded` clip made
 * `processing`, made fit for the web, written `ready` (or a failed try),
 * its source removed, `media.video_ready` emitted; the lock let go. One
 * clip a run: `runVideoQueue` runs it again for the next.
 */
export const transcodeNextVideoWorkflow = createWorkflow(
  "media-video-transcode-next",
  (input: { exclude: string[] }) => {
    const owner = takeVideoQueueStep()
    const video = claimNextVideoStep(
      transform({ owner, input }, ({ owner, input }) => ({ owner, exclude: input.exclude }))
    )
    const outcome = transcodeVideoStep(
      transform({ owner, video }, ({ owner, video }) => ({ owner, video }))
    )
    const settled = settleVideoStep(
      transform({ video, outcome }, ({ video, outcome }) => ({ video, outcome }))
    )
    removeVideoSourceStep(settled)
    when("media-video-ready-event", { settled }, ({ settled }) => settled?.status === "ready").then(
      () => {
        emitEventStep({
          eventName: MEDIA_VIDEO_READY,
          data: transform({ settled }, ({ settled }) => ({ id: settled?.id })),
        })
      }
    )
    releaseVideoQueueStep(owner)
    return new WorkflowResponse(
      transform({ owner, video, settled }, ({ owner, video, settled }): TranscodeNextResult => ({
        busy: owner === null,
        video_id: video?.id ?? null,
        status: settled?.status ?? null,
      }))
    )
  }
)

// Clips one run takes at most before it leaves the rest to the next minute
const CLIPS_PER_RUN = 20

async function workQueue(container: MedusaContainer): Promise<number> {
  // ffmpeg missing: the clips wait for it (adr/0069 §4), nothing is tried or failed
  if (!(await videoTools()).available) {
    return 0
  }
  const tried: string[] = []
  for (let turn = 0; turn < CLIPS_PER_RUN; turn++) {
    const { result } = await transcodeNextVideoWorkflow(container).run({
      input: { exclude: [...tried] },
    })
    if (result.busy || !result.video_id) {
      break
    }
    tried.push(result.video_id)
    forgetUsage("storage_mb")
  }
  return tried.length
}

let running: Promise<number> | null = null

/**
 * Works the queue until no clip waits (each clip a run of
 * `transcodeNextVideoWorkflow`); the uploaded event and the minute's job
 * both call it. Within a process a call while it works joins it; across
 * processes the lock keeps it to one. Never throws.
 */
export function runVideoQueue(container: MedusaContainer): Promise<number> {
  running ??= workQueue(container)
    .catch((error: unknown) => {
      logger.error({ event: "media.video_queue_failed", err: errorSummary(error) })
      return 0
    })
    .finally(() => {
      running = null
    })
  return running
}

/**
 * The sweeper (adr/0069 §4): a clip `processing` without a heartbeat for
 * 10 minutes (its process killed, the machine restarted) goes back to the
 * queue with one try more counted, or fails past its three.
 */
export async function requeueStaleVideos(
  container: MedusaContainer,
  now: number = Date.now()
): Promise<{ id: string; status: string }[]> {
  const moved = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .requeueStaleVideos(new Date(now - STALE_AFTER_MS), MAX_ATTEMPTS, PROCESSING_FAILED)
  if (moved.length > 0) {
    logger.warn({ event: "media.video_requeued", videos: moved })
  }
  return moved
}
