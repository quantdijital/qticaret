import { RetryableError, ValidationError } from "../../errors"
import { logger } from "../../logging"
import {
  PROBE_CONCURRENCY,
  PROBE_MAX_OUTPUT_BYTES,
  PROBE_MAX_WAITING,
  PROBE_TIMEOUT_MS,
  PROBE_WAIT_TIMEOUT_MS,
} from "./limits"
import { assessProbe } from "./probe-verdict"
import type { ProbeVerdict } from "./probe-verdict"
import { ToolStartError, runTool } from "./run-tool"
import type { Spawner } from "./run-tool"
import type { VideoDemuxer } from "./signature"
import { createSlots } from "./slots"
import type { Slots } from "./slots"
import { videoToolPaths } from "./paths"
import { probeArgs } from "./probe-args"

/**
 * ffprobe on an uploaded clip (adr/0069 §3), the second gate after the
 * signature, with the argument list and bounds of `probe-args.ts`.
 */

const busy = () => new RetryableError("video.upload_busy", { retryAfterMs: 10_000 })

const probeSlots: Slots = createSlots({
  concurrency: PROBE_CONCURRENCY,
  maxWaiting: PROBE_MAX_WAITING,
  waitTimeoutMs: PROBE_WAIT_TIMEOUT_MS,
  busy,
})

const unreadable = () => new ValidationError("video.unreadable", { field: "file" })

/**
 * ffprobe ran past its time or was killed by a signal: to an upload the
 * same `video.unreadable`, but the transcoding job tries such a clip again
 * (security review S7): a busy machine, not the shop's file.
 */
export class ProbeStoppedError extends ValidationError {
  constructor() {
    super("video.unreadable", { field: "file" })
  }
}

export interface ProbeOptions {
  /** A stand-in for Node's spawn (tests). */
  spawn?: Spawner
  /** Another limiter (tests). */
  slots?: Slots
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
  /** Fired, ffprobe is killed (or never started): `ProbeStoppedError`. */
  signal?: AbortSignal
}

/**
 * The clip's size and length, or a `ValidationError` (`video.*`): ffprobe
 * failed, ran past 15 s (killed), answered too much, answered something
 * that is not its JSON, or the clip breaks a limit. At most two run at
 * once and eight wait (none past 15 s); beyond, `video.upload_busy` (503).
 * ffprobe missing: `video.upload_unavailable` (503).
 */
export async function probeVideo(
  path: string,
  demuxer: VideoDemuxer,
  options: ProbeOptions = {}
): Promise<ProbeVerdict> {
  const args = probeArgs(demuxer, path)
  const release = await (options.slots ?? probeSlots).take()
  let output: Buffer
  try {
    const run = await runTool(videoToolPaths(options.env).ffprobe, args, {
      timeoutMs: options.timeoutMs ?? PROBE_TIMEOUT_MS,
      maxOutputBytes: PROBE_MAX_OUTPUT_BYTES,
      ...(options.spawn ? { spawn: options.spawn } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    })
    if (run.aborted) {
      // Stopped by the caller (the transcoding job's time, a removal): nothing about the clip
      throw new ProbeStoppedError()
    }
    if (run.timedOut || run.overflow || run.code !== 0) {
      // ffprobe's own words are not logged: they may quote the file's contents
      logger.info({
        event: "media.video_probe_refused",
        timed_out: run.timedOut,
        overflow: run.overflow,
        code: run.code,
        signal: run.signal,
      })
      throw run.timedOut || (run.signal !== null && !run.overflow)
        ? new ProbeStoppedError()
        : unreadable()
    }
    output = run.stdout
  } catch (error) {
    if (error instanceof ToolStartError) {
      logger.error({ event: "media.video_unavailable", missing: ["ffprobe"], code: error.code })
      throw new RetryableError("video.upload_unavailable")
    }
    throw error
  } finally {
    release()
  }
  let json: unknown
  try {
    json = JSON.parse(output.toString("utf8"))
  } catch {
    throw unreadable()
  }
  return assessProbe(json, demuxer)
}
