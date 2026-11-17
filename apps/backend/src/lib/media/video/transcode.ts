import { readFile, stat, statfs } from "node:fs/promises"
import { setPriority } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import { errorSummary, logger } from "../../logging"
import {
  DARK_FRAME_MEAN,
  ENCODE_PRIORITY,
  JOB_TIMEOUT_MS,
  PASS_TIMEOUT_MS,
  PROBE_MAX_OUTPUT_BYTES,
  PROBE_TIMEOUT_MS,
} from "./limits"
import { assessOutput } from "./output-verdict"
import type { OutputVerdict } from "./output-verdict"
import { videoToolPaths } from "./paths"
import { probeVideo } from "./probe"
import type { ProbeVerdict } from "./probe-verdict"
import { ToolStartError, runTool } from "./run-tool"
import type { Spawner, ToolRun } from "./run-tool"
import type { VideoDemuxer } from "./signature"
import { createSlots } from "./slots"
import type { Slots } from "./slots"
import { encodeArgs, outputProbeArgs, posterArgs } from "./transcode-args"
import type { OutputKind } from "./transcode-args"
import { infraError } from "./transcode-errors"

/**
 * A checked clip made fit for the web (adr/0069 §4 steps 2–7): ffprobe
 * again (the stored file may not be the one checked), the MP4 and the
 * WebM, each read back by ffprobe and held to its rules, and a PNG of the
 * first frame for the poster. One ffmpeg at a time in this process (the
 * shop-wide lock keeps it to one across processes), each at the lowest
 * priority, each pass killed after 4 minutes and every pass once the
 * caller's signal fires (the whole job's 10 minutes).
 */

const FFMPEG_OUTPUT_MAX = 64 * 1024

export interface TranscodeOptions {
  spawn?: Spawner
  env?: NodeJS.ProcessEnv
  /** Fired, the running pass is killed and none starts (the job's 10 minutes, a removal). */
  signal?: AbortSignal
  /** Another limiter (tests). */
  slots?: Slots
  passTimeoutMs?: number
}

export interface MadeOutput extends OutputVerdict {
  path: string
  bytes: number
}

export interface TranscodedClip {
  /** What ffprobe says of the source, again. */
  source: ProbeVerdict
  outputs: Record<OutputKind, MadeOutput>
  /** The poster's frame, a PNG of ours (still to go through the image pipeline). */
  poster: Buffer
}

// One encode at a time; those waiting wait for as long as a whole job may take
const encodeSlots: Slots = createSlots({
  concurrency: 1,
  maxWaiting: 8,
  waitTimeoutMs: JOB_TIMEOUT_MS,
  busy: () => infraError("video encode: no slot"),
})

// How many ffmpeg processes this process runs now, and the most at once (logs, tests)
const activity = { running: 0, peak: 0 }

/** ffmpeg processes running now and the most ever at once in this process. */
export const encodeActivity = (): { running: number; peak: number } => ({ ...activity })

/** Tests: forget the peak. */
export function resetEncodeActivity(): void {
  activity.peak = activity.running
}

function lowerPriority(pid: number): void {
  try {
    setPriority(pid, ENCODE_PRIORITY)
  } catch (error) {
    logger.warn({ event: "media.video_priority_not_set", err: errorSummary(error) })
  }
}

/** Free bytes on the disk that holds `dir` (`fs.statfs`). */
export async function freeDiskBytes(dir: string): Promise<number> {
  const info = await statfs(dir)
  return info.bavail * info.bsize
}

function failed(what: string, run: ToolRun): Error | null {
  if (run.aborted) {
    return infraError(`${what}: stopped (job time or removal)`)
  }
  if (run.timedOut) {
    return infraError(`${what}: past its time`)
  }
  if (run.overflow || run.code !== 0) {
    return infraError(`${what}: exit ${String(run.code)} ${String(run.signal)}`)
  }
  return null
}

async function runProgram(
  command: string,
  args: string[],
  what: string,
  options: TranscodeOptions & { timeoutMs: number; ffmpeg: boolean }
): Promise<Buffer> {
  let run: ToolRun
  if (options.ffmpeg) {
    activity.running += 1
    activity.peak = Math.max(activity.peak, activity.running)
  }
  try {
    run = await runTool(command, args, {
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.ffmpeg ? FFMPEG_OUTPUT_MAX : PROBE_MAX_OUTPUT_BYTES,
      onSpawn: lowerPriority,
      ...(options.spawn ? { spawn: options.spawn } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (error) {
    if (error instanceof ToolStartError) {
      throw infraError(`${what}: did not start (${error.code ?? "unknown"})`)
    }
    throw error
  } finally {
    if (options.ffmpeg) {
      activity.running -= 1
    }
  }
  const refusal = failed(what, run)
  if (refusal) {
    throw refusal
  }
  return run.stdout
}

async function checkOutput(
  kind: OutputKind,
  path: string,
  options: TranscodeOptions
): Promise<MadeOutput> {
  const stdout = await runProgram(
    videoToolPaths(options.env).ffprobe,
    outputProbeArgs(kind, path),
    `ffprobe ${kind}`,
    { ...options, timeoutMs: PROBE_TIMEOUT_MS, ffmpeg: false }
  )
  let json: unknown
  try {
    json = JSON.parse(stdout.toString("utf8"))
  } catch {
    throw infraError(`ffprobe ${kind}: not its JSON`)
  }
  const verdict = assessOutput(json, kind)
  return { ...verdict, path, bytes: (await stat(path)).size }
}

/** The mean brightness of a frame, 0–255 (the colour channels' means, averaged). */
export async function frameBrightness(png: Buffer): Promise<number> {
  const { channels } = await sharp(png).stats()
  const colour = channels.slice(0, 3)
  return colour.reduce((sum, channel) => sum + channel.mean, 0) / Math.max(1, colour.length)
}

/**
 * The poster's frame (Kararlar 10): the first; when it is all but black
 * (a fade in) and the clip lasts past a second, the one at 1 s.
 */
async function posterFrame(
  mp4: MadeOutput,
  dir: string,
  ffmpeg: (args: string[], what: string) => Promise<Buffer>
): Promise<Buffer> {
  const first = join(dir, "poster.png")
  await ffmpeg(posterArgs(mp4.path, first), "ffmpeg poster")
  const frame = await readFile(first)
  if (mp4.durationMs <= 1000 || (await frameBrightness(frame)) >= DARK_FRAME_MEAN) {
    return frame
  }
  const later = join(dir, "poster-1s.png")
  await ffmpeg(posterArgs(mp4.path, later, 1), "ffmpeg poster at 1 s")
  return readFile(later)
}

/**
 * Steps 2–7 on the source at `source` (a file of ours in the job's
 * private directory `dir`, read with `demuxer`). Throws `ValidationError`
 * (`video.*`) when ffprobe refuses the clip (an input error) and
 * `VideoJobError` for the rest; the files it made stay in `dir`, which the
 * caller removes.
 */
export async function transcodeClip(
  source: string,
  demuxer: VideoDemuxer,
  dir: string,
  options: TranscodeOptions = {}
): Promise<TranscodedClip> {
  const probed = await probeVideo(source, demuxer, {
    ...(options.spawn ? { spawn: options.spawn } : {}),
    ...(options.env ? { env: options.env } : {}),
  })
  const release = await (options.slots ?? encodeSlots).take()
  try {
    const ffmpeg = (args: string[], what: string) =>
      runProgram(videoToolPaths(options.env).ffmpeg, args, what, {
        ...options,
        timeoutMs: options.passTimeoutMs ?? PASS_TIMEOUT_MS,
        ffmpeg: true,
      })
    const made = {} as Record<OutputKind, MadeOutput>
    for (const kind of ["mp4", "webm"] as const) {
      const path = join(dir, `output.${kind}`)
      await ffmpeg(encodeArgs(kind, demuxer, source, path), `ffmpeg ${kind}`)
      made[kind] = await checkOutput(kind, path, options)
    }
    const poster = await posterFrame(made.mp4, dir, ffmpeg)
    return { source: probed, outputs: made, poster }
  } finally {
    release()
  }
}
