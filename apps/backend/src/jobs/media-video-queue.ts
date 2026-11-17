import { tmpdir } from "node:os"
import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { sweepStaleVideoTempDirs } from "../lib/media/video/temp-files"
import { requeueStaleVideos, runVideoQueue } from "../workflows/media/video/transcode"

// Past any job's 10 minutes and any upload's two: a directory this old was left by a dead process
const TEMP_DIR_STALE_MS = 30 * 60 * 1000

/**
 * Every minute (adr/0069 §4): clips whose job went silent for 10 minutes
 * go back to the queue (or fail past their tries), working directories a
 * dead process left behind are removed (review S5), then the queue is set
 * going. Not waited for: a run may take minutes, and the shop-wide lock
 * keeps it to one clip at a time however often this fires.
 */
export default async function mediaVideoQueue(container: MedusaContainer) {
  try {
    await requeueStaleVideos(container)
  } catch (error) {
    logger.warn({ event: "media.video_requeue_failed", err: errorSummary(error) })
  }
  await sweepStaleVideoTempDirs(tmpdir(), Date.now(), TEMP_DIR_STALE_MS)
  void runVideoQueue(container)
}

export const config = {
  name: "media-video-queue",
  schedule: "* * * * *",
}
