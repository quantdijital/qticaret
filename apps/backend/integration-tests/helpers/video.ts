import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { videoToolPaths } from "../../src/lib/media/video"
import { VIDEO_QUEUE_LOCK } from "../../src/workflows/media/video/transcode-steps"

/**
 * Product video suites (adr/0069): whether ffmpeg and its encoders are
 * here, clips made by ffmpeg (nothing binary in the repository), what
 * ffprobe says of a stored file, and the transcoding queue held still.
 */

const paths = videoToolPaths()
const answers = (command: string, args: string[]) =>
  spawnSync(command, args, { encoding: "utf8", timeout: 10_000 })

const encoders = answers(paths.ffmpeg, ["-hide_banner", "-encoders"])
/** ffprobe, ffmpeg and the encoders the job uses (lib/media/video/tools.ts). */
export const videoToolsPresent =
  answers(paths.ffprobe, ["-version"]).status === 0 &&
  encoders.status === 0 &&
  encoders.stdout.includes(" libx264 ") &&
  encoders.stdout.includes(" libvpx-vp9 ")

export const lavfi = (spec: string) => ["-f", "lavfi", "-i", spec]

/** A folder of clips for one test file; `clip` makes one there with ffmpeg. */
export function clipMaker(prefix = "qt-video-clips-") {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  return {
    dir,
    clip(name: string, args: string[]): Buffer {
      const out = join(dir, name)
      const run = answers(paths.ffmpeg, ["-hide_banner", "-v", "error", "-y", ...args, out])
      if (run.status !== 0) {
        throw new Error(`ffmpeg failed: ${run.stderr}`)
      }
      return readFileSync(out)
    },
    remove() {
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

export interface StoredProbe {
  streams: { codec_type: string; width?: number; height?: number; tags?: Record<string, string> }[]
  format: { duration: string; tags?: Record<string, string> }
}

/** ffprobe on a file in storage (read whole through the File Module). */
export async function probeStored(
  container: MedusaContainer,
  fileId: string,
  dir: string
): Promise<StoredProbe> {
  const bytes = await container.resolve(Modules.FILE).getAsBuffer(fileId)
  const path = join(dir, `stored-${String(Date.now())}`)
  writeFileSync(path, bytes)
  const run = answers(paths.ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height:stream_tags:format=duration:format_tags",
    "-of",
    "json",
    path,
  ])
  rmSync(path, { force: true })
  return JSON.parse(run.stdout) as StoredProbe
}

/** Whether storage still has the file. */
export async function stored(container: MedusaContainer, fileId: string): Promise<boolean> {
  try {
    await container.resolve(Modules.FILE).getAsBuffer(fileId)
    return true
  } catch {
    return false
  }
}

/**
 * The transcoding queue's lock held until the returned release: the job
 * (the upload's event, the minute's run) finds it busy and leaves.
 */
export async function holdVideoQueueLock(container: MedusaContainer) {
  let release: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let held: () => void = () => undefined
  const holding = new Promise<void>((resolve) => {
    held = resolve
  })
  const done = container.resolve(Modules.LOCKING).execute(
    VIDEO_QUEUE_LOCK,
    async () => {
      held()
      await released
    },
    { timeout: 30 }
  )
  await holding
  return async () => {
    release()
    await done
  }
}
