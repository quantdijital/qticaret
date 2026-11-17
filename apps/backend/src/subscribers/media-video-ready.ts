import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { SEO_REDIRECTS_MODULE } from "../modules/seo-redirects"
import type SeoRedirectsModuleService from "../modules/seo-redirects/service"
import { MEDIA_VIDEO_READY } from "../workflows/media/video/transcode"

/**
 * A video just ready (a clip processed, a YouTube video added) is in its
 * product page's structured data at once (adr/0069 §9), not within the
 * resolve cache's 30 seconds: every process forgets its answers. A title
 * change or a removal waits for the cache, as any missed event would.
 */
export default async function mediaVideoReady({ container }: SubscriberArgs<{ id: string }>) {
  try {
    await container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions()
  } catch (error) {
    logger.warn({ event: "media.video_ready_seo_failed", err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: MEDIA_VIDEO_READY,
}
