import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { MEDIA_REGISTERED, deriveLibraryMediaWorkflow } from "../workflows/media/workflows"

/**
 * A library picture just uploaded (a cover, a post's picture, an author's
 * photo, a picture in a text) gets its WebP/AVIF versions after the upload
 * answers, as a product image does; a failure never fails the upload, and
 * `media:derivatives apply` makes the ones still missing.
 */
export default async function mediaVersions({
  event,
  container,
}: SubscriberArgs<{ ids: string[] }>) {
  try {
    await deriveLibraryMediaWorkflow(container).run({ input: { ids: event.data.ids } })
  } catch (error) {
    logger.warn({
      event: "media.derive_failed",
      count: event.data.ids.length,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = {
  event: MEDIA_REGISTERED,
}
