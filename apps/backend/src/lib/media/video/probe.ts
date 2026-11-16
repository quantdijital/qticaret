import { isAbsolute } from "node:path"
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
import { videoToolPaths } from "./tools"

/**
 * ffprobe on an uploaded clip (adr/0069 §3), the second gate after the
 * signature. The demuxer is forced from the signature (`-f mov|matroska`),
 * so ffprobe never guesses the format from content: the HLS, concat and
 * other demuxers that open further files are never chosen. Only the `file`
 * protocol is allowed, and the input is our own path with its `file:`
 * prefix: a nested `concat:`, `subfile:`, `data:`, `http:` or `hls:` path
 * inside the clip cannot be opened. A MOV's external data references stay
 * off by name too (`-enable_drefs 0`, `-use_absolute_path 0`).
 */

// Only what the verdict reads: no tags (they hold places, devices, names)
const SHOW_ENTRIES = [
  "stream=index,codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,nb_frames,duration",
  "stream_disposition=attached_pic",
  "format=format_name,duration,nb_streams",
].join(":")

// A MOV may point at other files (data references); both are off by default, and stay off
const DEMUXER_OPTIONS: Readonly<Record<VideoDemuxer, readonly string[]>> = {
  mov: ["-enable_drefs", "0", "-use_absolute_path", "0"],
  matroska: [],
  gif: [],
}

/** ffprobe's whole argument list for a clip at `path` read with `demuxer`. */
export function probeArgs(demuxer: VideoDemuxer, path: string): string[] {
  if (!isAbsolute(path) || path.includes("\n") || path.includes("\0")) {
    throw new Error("video probe: the path must be one of ours, absolute")
  }
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-protocol_whitelist",
    "file",
    ...DEMUXER_OPTIONS[demuxer],
    "-f",
    demuxer,
    "-show_entries",
    SHOW_ENTRIES,
    "-of",
    "json",
    "-i",
    `file:${path}`,
  ]
}

const busy = () => new RetryableError("video.upload_busy", { retryAfterMs: 10_000 })

const probeSlots: Slots = createSlots({
  concurrency: PROBE_CONCURRENCY,
  maxWaiting: PROBE_MAX_WAITING,
  waitTimeoutMs: PROBE_WAIT_TIMEOUT_MS,
  busy,
})

const unreadable = () => new ValidationError("video.unreadable", { field: "file" })

export interface ProbeOptions {
  /** A stand-in for Node's spawn (tests). */
  spawn?: Spawner
  /** Another limiter (tests). */
  slots?: Slots
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
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
    })
    if (run.timedOut || run.overflow || run.code !== 0) {
      // ffprobe's own words are not logged: they may quote the file's contents
      logger.info({
        event: "media.video_probe_refused",
        timed_out: run.timedOut,
        overflow: run.overflow,
        code: run.code,
        signal: run.signal,
      })
      throw unreadable()
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
