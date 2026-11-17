import { join } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../../lib/logging"
import { HEARTBEAT_MS, JOB_TIMEOUT_MS, MIN_FREE_DISK_BYTES } from "../../../lib/media/video/limits"
import { makePoster, videoFileBase } from "../../../lib/media/video/poster"
import type { VideoDemuxer, VideoSourceFormat } from "../../../lib/media/video/signature"
import { makeVideoTempDir, removeVideoTempDir } from "../../../lib/media/video/temp-files"
import { freeDiskBytes, transcodeClip } from "../../../lib/media/video/transcode"
import type { TranscodeOptions } from "../../../lib/media/video/transcode"
import { classifyFailure, infraError, inputError } from "../../../lib/media/video/transcode-errors"
import type { Failure } from "../../../lib/media/video/transcode-errors"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { ClaimedVideo, ReadyVideo } from "../../../modules/media/service"
import { removeFiles } from "../files"
import { downloadSource, storeOutputs, videoNaming } from "./outputs"
import { watchJob } from "./watch"

/**
 * One clip through the job (adr/0069 §4 steps 1–7): the source down to a
 * private directory of its own (0700; not begun below 500 MB of free
 * disk), ffprobe, the MP4, the WebM and the poster made and checked, then
 * stored public. The job is watched (`watch.ts`: heartbeat, lock, 10
 * minutes); stopped, ffmpeg and any transfer are cut. On any failure the
 * files stored so far are removed; the directory always is.
 */

const DEMUXER: Readonly<Record<VideoSourceFormat, VideoDemuxer>> = {
  mp4: "mov",
  mov: "mov",
  webm: "matroska",
}

/** The demuxer a stored source is read with; any other format (never written) is refused. */
export function sourceDemuxer(format: string): VideoDemuxer {
  const demuxer = Object.hasOwn(DEMUXER, format) ? DEMUXER[format as VideoSourceFormat] : undefined
  if (!demuxer) {
    throw inputError("video.unsupported_type", `video job: source format ${format}`)
  }
  return demuxer
}

export type ProcessOutcome =
  | { ok: true; ready: ReadyVideo; fileIds: string[] }
  | { ok: false; failure: Failure }
  /** The video stopped being the job's while it ran (removed, swept back): nothing is written. */
  | { ok: false; gone: true }

export interface ProcessOptions {
  /** Holds the shop's lock on; called with the heartbeat. */
  keepLock?: () => Promise<void>
  /** Tests: other programs, a shorter time. */
  transcode?: TranscodeOptions
  heartbeatMs?: number
  jobTimeoutMs?: number
}

export async function processVideo(
  container: MedusaContainer,
  video: ClaimedVideo,
  options: ProcessOptions = {}
): Promise<ProcessOutcome> {
  const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
  const stored: string[] = []
  const dir = await makeVideoTempDir()
  // Watched from here (review S3): no timer outlives a directory that could not be made
  const watch = watchJob(media, video, {
    heartbeatMs: options.heartbeatMs ?? HEARTBEAT_MS,
    jobTimeoutMs: options.jobTimeoutMs ?? JOB_TIMEOUT_MS,
    ...(options.keepLock ? { keepLock: options.keepLock } : {}),
  })
  const { signal } = watch
  const stillOn = (when: string) => {
    if (signal.aborted) {
      throw infraError(`video job: stopped ${when}`)
    }
  }
  try {
    if ((await freeDiskBytes(dir)) < MIN_FREE_DISK_BYTES) {
      throw infraError("video job: under 500 MB of free disk")
    }
    const demuxer = sourceDemuxer(video.source_format)
    const source = join(dir, "source")
    await downloadSource(container, video.source_file_id, source, signal)
    const clip = await transcodeClip(source, demuxer, dir, {
      ...options.transcode,
      signal,
    })
    const poster = await makePoster(clip.poster)
    const { slug, n } = await videoNaming(container, video.id)
    stillOn("before storing")
    const saved = await storeOutputs(
      container,
      videoFileBase(slug, n),
      clip.outputs,
      poster,
      (fileId) => stored.push(fileId),
      signal
    )
    stillOn("while storing")
    return {
      ok: true,
      fileIds: [...stored],
      ready: {
        width: clip.outputs.mp4.width,
        height: clip.outputs.mp4.height,
        duration_ms: clip.outputs.mp4.durationMs,
        outputs: saved.outputs,
        output_file_ids: saved.output_file_ids,
        poster: saved.poster,
        poster_file_ids: saved.poster_file_ids,
        // The source too, until it is removed (the workflow's last step)
        stored_bytes: saved.bytes + (video.source_bytes ?? 0),
      },
    }
  } catch (error) {
    await watch.stop()
    await removeFiles(container, stored)
    if (watch.state.gone) {
      logger.info({ event: "media.video_job_left", video_id: video.id })
      return { ok: false, gone: true }
    }
    const failure = classifyFailure(error)
    logger.warn({
      event: "media.video_job_failed",
      video_id: video.id,
      kind: failure.kind,
      code: failure.code,
      err: errorSummary(error),
    })
    return { ok: false, failure }
  } finally {
    await watch.stop()
    await removeVideoTempDir(dir)
  }
}
