import { errorSummary, logger } from "../../logging"
import { videoToolPaths } from "./paths"
import { runTool } from "./run-tool"
import type { Spawner } from "./run-tool"
import { probeSelfTest } from "./self-test"

/**
 * ffmpeg and ffprobe on this machine (adr/0069 §4): the distribution's
 * package, found at `FFMPEG_PATH` / `FFPROBE_PATH` or on `PATH`. Checked
 * once at start (both answer `-version`, ffmpeg has the encoders slice 2
 * uses, and ffprobe reads a clip ffmpeg makes with the bounds every
 * upload gets: `self-test.ts`) and kept in memory. Missing, video uploads are closed with
 * `video.upload_unavailable` and the panel hides the option; one error is
 * logged. The panel learns only "available or not", never why.
 */

const CHECK_TIMEOUT_MS = 10_000
const VERSION_OUTPUT_MAX = 64 * 1024
const ENCODERS_OUTPUT_MAX = 512 * 1024
// The encoders the transcoding job (slice 2) runs: H.264 for MP4, VP9 for WebM
export const REQUIRED_ENCODERS = ["libx264", "libvpx-vp9"] as const
// adr/0069 §4: version 7 or later; an older one is logged, not refused
const MIN_MAJOR_VERSION = 7

export interface VideoToolCheck {
  available: boolean
  /** What is missing, for the log: `ffmpeg`, `ffprobe`, an encoder's name. */
  missing: string[]
  /** ffmpeg's version as it names itself (`7.1.1`), for the log. */
  version: string | null
}

const VERSION_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-_+~"

/** The word after "version " on the first line, at most 40 safe characters. */
export function versionOf(output: string): string | null {
  const line = output.slice(0, 200).split("\n", 1)[0] ?? ""
  const at = line.indexOf(" version ")
  if (at < 0) {
    return null
  }
  let version = ""
  for (const char of line.slice(at + 9, at + 49)) {
    if (!VERSION_CHARS.includes(char)) {
      break
    }
    version += char
  }
  return version === "" ? null : version
}

/** The major number of a version (`7.1.1` → 7, `n7.0` → 7), or null (a git build's `N-…`). */
export function majorOf(version: string | null): number | null {
  if (version === null) {
    return null
  }
  const digits = version.startsWith("n") ? version.slice(1) : version
  const major = Number.parseInt(digits, 10)
  return Number.isSafeInteger(major) ? major : null
}

async function answers(
  command: string,
  args: string[],
  maxOutputBytes: number,
  spawn: Spawner | undefined
): Promise<string | null> {
  try {
    const run = await runTool(command, args, {
      timeoutMs: CHECK_TIMEOUT_MS,
      maxOutputBytes,
      ...(spawn ? { spawn } : {}),
    })
    return run.code === 0 && !run.timedOut && !run.overflow ? run.stdout.toString("utf8") : null
  } catch {
    return null
  }
}

/**
 * Checks the programs now: whether both answer, ffmpeg has the encoders,
 * and ffprobe runs with the upload's bounding options (`probe_options`).
 */
export async function checkVideoTools(
  options: { env?: NodeJS.ProcessEnv; spawn?: Spawner } = {}
): Promise<VideoToolCheck> {
  const paths = videoToolPaths(options.env)
  const [probe, ffmpeg] = await Promise.all([
    answers(paths.ffprobe, ["-version"], VERSION_OUTPUT_MAX, options.spawn),
    answers(paths.ffmpeg, ["-version"], VERSION_OUTPUT_MAX, options.spawn),
  ])
  const missing = [...(probe === null ? ["ffprobe"] : []), ...(ffmpeg === null ? ["ffmpeg"] : [])]
  if (ffmpeg !== null) {
    const encoders = await answers(
      paths.ffmpeg,
      ["-hide_banner", "-encoders"],
      ENCODERS_OUTPUT_MAX,
      options.spawn
    )
    for (const encoder of REQUIRED_ENCODERS) {
      if (!encoders?.includes(` ${encoder} `)) {
        missing.push(encoder)
      }
    }
  }
  if (missing.length === 0 && !(await probeSelfTest(paths, options.spawn))) {
    missing.push("probe_options")
  }
  return { available: missing.length === 0, missing, version: versionOf(ffmpeg ?? "") }
}

let checked: Promise<VideoToolCheck> | null = null

/** The check made once per process (at start, by the media module's loader), then kept. */
export function videoTools(): Promise<VideoToolCheck> {
  checked ??= checkVideoTools()
    .then((check) => {
      if (!check.available) {
        logger.error({ event: "media.video_unavailable", missing: check.missing })
      } else {
        const major = majorOf(check.version)
        logger.info({ event: "media.video_tools", version: check.version })
        if (major !== null && major < MIN_MAJOR_VERSION) {
          logger.warn({ event: "media.video_tools_old", version: check.version })
        }
      }
      return check
    })
    .catch((error: unknown) => {
      logger.error({ event: "media.video_unavailable", err: errorSummary(error) })
      return { available: false, missing: ["check_failed"], version: null }
    })
  return checked
}

/** Whether video uploads are open on this machine (the panel's `upload`). */
export const videoUploadAvailable = async (): Promise<boolean> => (await videoTools()).available

/** Tests: forget the kept check. */
export function resetVideoToolsCheck(): void {
  checked = null
}
