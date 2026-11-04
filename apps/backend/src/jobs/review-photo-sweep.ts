import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { ABANDONED_PHOTO_MS, removeReviewPhotos } from "../workflows/customers/review-photos"

/**
 * Review photos no review took within a day go each night, files and all
 * (adr/0037 §4 Ek 2026-11-04): a form closed before the review was sent
 * leaves a customer's photo behind, and it is personal data (KVKK).
 */
export default async function reviewPhotoSweep(container: MedusaContainer) {
  const removed = await removeReviewPhotos(container, {
    abandoned_before: new Date(Date.now() - ABANDONED_PHOTO_MS),
  })
  logger.info({ event: "reviews.photos_swept", removed })
}

export const config = {
  name: "review-photo-sweep",
  schedule: "15 4 * * *",
}
