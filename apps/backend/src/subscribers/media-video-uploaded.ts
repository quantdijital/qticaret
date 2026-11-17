import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runVideoQueue } from "../workflows/media/video/transcode"
import { MEDIA_VIDEO_UPLOADED } from "../workflows/media/video/workflows"

/**
 * A clip just stored waits for the transcoding job (adr/0069 §4): the
 * queue is set going without waiting for it (a clip takes minutes; the
 * event is not held that long). Busy elsewhere, the minute's job
 * (`jobs/media-video-queue.ts`) takes it.
 */
export default function mediaVideoUploaded({ container }: SubscriberArgs<{ id: string }>) {
  void runVideoQueue(container)
  return Promise.resolve()
}

export const config: SubscriberConfig = {
  event: MEDIA_VIDEO_UPLOADED,
}
