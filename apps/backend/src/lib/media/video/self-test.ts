import { join } from "node:path"
import { probeArgs } from "./probe-args"
import { assessProbe } from "./probe-verdict"
import type { VideoToolPaths } from "./paths"
import { runTool } from "./run-tool"
import type { Spawner } from "./run-tool"
import { makeVideoTempDir, removeVideoTempDir } from "./temp-files"

/**
 * At start, once (security review O1): ffmpeg makes a one-second clip and
 * ffprobe reads it with the very arguments an upload gets. An ffprobe that
 * does not know one of the bounding options (an old build) fails here, and
 * uploads stay closed: never run without its bounds, never refuse every
 * upload in silence.
 */

const SELF_TEST_TIMEOUT_MS = 15_000
const OUTPUT_MAX = 64 * 1024

export async function probeSelfTest(paths: VideoToolPaths, spawn?: Spawner): Promise<boolean> {
  const dir = await makeVideoTempDir()
  const clip = join(dir, "self-test.mp4")
  const options = {
    timeoutMs: SELF_TEST_TIMEOUT_MS,
    maxOutputBytes: OUTPUT_MAX,
    ...(spawn ? { spawn } : {}),
  }
  try {
    const made = await runTool(
      paths.ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=64x48:rate=5:duration=1",
        "-c:v",
        "mpeg4",
        "-y",
        clip,
      ],
      options
    )
    if (made.code !== 0 || made.timedOut || made.overflow) {
      return false
    }
    const read = await runTool(paths.ffprobe, probeArgs("mov", clip), options)
    if (read.code !== 0 || read.timedOut || read.overflow) {
      return false
    }
    const verdict = assessProbe(JSON.parse(read.stdout.toString("utf8")), "mov")
    return verdict.width === 64 && verdict.height === 48
  } catch {
    return false
  } finally {
    await removeVideoTempDir(dir)
  }
}
