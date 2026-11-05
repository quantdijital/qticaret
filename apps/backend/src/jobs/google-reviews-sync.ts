import type { MedusaContainer } from "@medusajs/framework/types"
import {
  purgeStaleGoogleReviewsWorkflow,
  syncGoogleReviewsWorkflow,
} from "../workflows/google/reviews-sync"

/**
 * The shop's Google reviews read again once a day (adr/0058): new and
 * changed ones kept, removed ones forgotten; then, if no sync has reached
 * Google for 30 days, what it gave is forgotten (Google's storage limit).
 */
export default async function googleReviewsSync(container: MedusaContainer) {
  await syncGoogleReviewsWorkflow(container).run({ input: { trigger: "schedule" } })
  await purgeStaleGoogleReviewsWorkflow(container).run({ input: {} })
}

export const config = {
  name: "google-reviews-sync",
  // 04:20 UTC, 07:20 in Türkiye: before the shop opens, away from the other Google jobs
  schedule: "20 4 * * *",
}
