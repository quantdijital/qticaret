import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { requeueStaleVideos, runVideoQueue } from "../workflows/media/video/transcode"

/**
 * Every minute (adr/0069 §4): clips whose job went silent for 10 minutes
 * go back to the queue (or fail past their tries), then the queue is set
 * going. Not waited for: a run may take minutes, and the shop-wide lock
 * keeps it to one clip at a time however often this fires.
 */
export default async function mediaVideoQueue(container: MedusaContainer) {
  try {
    await requeueStaleVideos(container)
  } catch (error) {
    logger.warn({ event: "media.video_requeue_failed", err: errorSummary(error) })
  }
  void runVideoQueue(container)
}

export const config = {
  name: "media-video-queue",
  schedule: "* * * * *",
}
