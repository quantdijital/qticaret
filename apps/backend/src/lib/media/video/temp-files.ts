import { mkdtemp, open, readdir, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { errorSummary, logger } from "../../logging"
import { SIGNATURE_BYTES } from "./limits"

const PREFIX = "qt-video-"
const HOUR_MS = 60 * 60 * 1000

/** A fresh private directory for one upload's file (mkdtemp makes it 0700). */
export const makeVideoTempDir = (root: string = tmpdir()): Promise<string> =>
  mkdtemp(join(root, PREFIX))

/**
 * Removes an upload's directory and what is in it; never throws. A
 * directory that cannot be removed is logged (review B-3) and taken by
 * the sweep at the next start (`sweepStaleVideoTempDirs`).
 */
export async function removeVideoTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true })
  } catch (error) {
    logger.warn({ event: "media.video_temp_not_removed", err: errorSummary(error) })
  }
}

/**
 * At start (review B-3): upload directories left by a process that ended
 * mid-upload (killed, out of memory) are removed. Only those untouched
 * for an hour: an upload running now is never older than two minutes
 * (`RECEIVE_TIMEOUTS`) plus its check. Never throws; returns how many went.
 */
export async function sweepStaleVideoTempDirs(
  root: string = tmpdir(),
  now: number = Date.now(),
  olderThanMs: number = HOUR_MS
): Promise<number> {
  let removed = 0
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(PREFIX)) {
        continue
      }
      const dir = join(root, entry.name)
      const { mtimeMs } = await stat(dir)
      if (now - mtimeMs > olderThanMs) {
        await removeVideoTempDir(dir)
        removed += 1
      }
    }
  } catch (error) {
    logger.warn({ event: "media.video_temp_sweep_failed", err: errorSummary(error) })
  }
  if (removed > 0) {
    logger.info({ event: "media.video_temp_swept", removed })
  }
  return removed
}

/** The first bytes of a received file, enough to tell what it is. */
export async function readHead(
  path: string,
  length: number = SIGNATURE_BYTES
): Promise<Uint8Array> {
  const handle = await open(path, "r")
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
