import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { isProviderError, isValidationError } from "../../lib/errors"
import { businessProfileApi } from "../../lib/google/business-profile"
import type { GoogleReviewInput } from "../../lib/google/business-review"
import { errorSummary, logger } from "../../lib/logging"
import {
  businessProfileToken,
  chooseGoogleReviewLocationWorkflow,
  googleReviewLocations,
  googleReviewsOf,
} from "./reviews"

/** Pages read in one sync at most (50 reviews each); past them, nothing is removed. */
const MAX_PAGES = 100

/**
 * How old what Google gave may get here (Business Profile API policies:
 * content stored at most 30 calendar days): past it, the reviews, the
 * average and the count are forgotten until a sync reads them again.
 */
export const GOOGLE_CONTENT_MAX_DAYS = 30

export interface GoogleReviewsSyncResult {
  ran: boolean
  added: number
  updated: number
  removed: number
  /** Google's word, or ours (`reviews_scope`, `not_connected`), when the sync stopped. */
  error: string | null
}

const idle: GoogleReviewsSyncResult = { ran: false, added: 0, updated: 0, removed: 0, error: null }

// The shop's own to mend in the panel (connect again): not the operator's
const SHOP_SIDE = new Set(["invalid_grant", "reviews_scope", "not_connected"])

/**
 * Reads the picked location's reviews from Google (adr/0058), every page
 * up to `MAX_PAGES`, with Google's own average and count, and keeps them:
 * new ones added, changed ones updated, those Google no longer has
 * removed. Google out of reach or refusing stops the sync: what was kept
 * stays (until `GOOGLE_CONTENT_MAX_DAYS`), the reason is noted for the
 * panel and logged. Nothing to undo at Google (only read).
 */
const syncGoogleReviewsStep = createStep(
  "google-reviews-sync",
  async (input: { trigger: "schedule" | "panel" | "chosen" }, { container }) => {
    const reviews = googleReviewsOf(container)
    const location = await reviews.currentLocation()
    if (!location) {
      return new StepResponse(idle)
    }
    try {
      const token = await businessProfileToken(container)
      const api = businessProfileApi()
      const read: GoogleReviewInput[] = []
      let average: number | null = null
      let total: number | null = null
      let pageToken: string | undefined
      let complete = false
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const answer = await api.listReviews(token, location.account, location.location, pageToken)
        read.push(...answer.reviews)
        if (page === 0) {
          average = answer.averageRating
          total = answer.totalReviewCount
        }
        pageToken = answer.nextPageToken ?? undefined
        if (!pageToken) {
          complete = true
          break
        }
      }
      const counts = await reviews.applySync({
        account: location.account,
        location: location.location,
        average_rating: average,
        total_review_count: total,
        reviews: read,
        complete,
      })
      if (!counts) {
        return new StepResponse(idle)
      }
      logger.info({ event: "google_reviews.synced", trigger: input.trigger, ...counts })
      return new StepResponse({ ...idle, ...counts, ran: true })
    } catch (failure) {
      const code = isProviderError(failure)
        ? failure.providerCode
        : isValidationError(failure)
          ? failure.safeMessage.replace(/^google\./, "")
          : null
      if (code === null) {
        throw failure
      }
      await reviews.recordSyncError(location.location, code)
      const fields = { event: "google_reviews.sync_failed", trigger: input.trigger, code }
      if (SHOP_SIDE.has(code)) {
        logger.warn(fields)
      } else {
        // The platform's to look at: the API not enabled or approved (0 QPM), Google down
        logger.error({ ...fields, err: errorSummary(failure) })
      }
      return new StepResponse({ ...idle, ran: true, error: code })
    }
  }
)

export const syncGoogleReviewsWorkflow = createWorkflow(
  "google-reviews-sync",
  (input: { trigger: "schedule" | "panel" | "chosen" }) =>
    new WorkflowResponse(syncGoogleReviewsStep(input))
)

/**
 * Forgets what Google gave when no sync has read it for
 * `GOOGLE_CONTENT_MAX_DAYS` (the location stays picked). Nothing to undo:
 * the next sync that reaches Google reads it again.
 */
const purgeStaleGoogleReviewsStep = createStep(
  "google-reviews-purge-stale",
  async (input: { now?: string }, { container }) => {
    const now = input.now ? new Date(input.now) : new Date()
    const before = new Date(now.getTime() - GOOGLE_CONTENT_MAX_DAYS * 24 * 60 * 60 * 1000)
    const removed = await googleReviewsOf(container).purgeStale(before)
    if (removed > 0) {
      logger.error({ event: "google_reviews.stale_purged", removed, days: GOOGLE_CONTENT_MAX_DAYS })
    }
    return new StepResponse({ removed })
  }
)

export const purgeStaleGoogleReviewsWorkflow = createWorkflow(
  "google-reviews-purge-stale",
  (input: { now?: string }) => new WorkflowResponse(purgeStaleGoogleReviewsStep(input))
)

/**
 * Right after the shop connects for its Google reviews: with no location
 * picked and exactly one managed, it is picked and read at once. Best
 * effort: anything Google says here leaves the choice to the panel.
 */
export async function adoptOnlyGoogleLocation(
  container: Pick<MedusaContainer, "resolve">
): Promise<void> {
  try {
    if (await googleReviewsOf(container).currentLocation()) {
      return
    }
    const locations = await googleReviewLocations(container)
    const [only] = locations
    if (locations.length !== 1 || !only) {
      return
    }
    await chooseGoogleReviewLocationWorkflow(container as MedusaContainer).run({
      input: { account: only.account, location: only.location },
    })
    await syncGoogleReviewsWorkflow(container as MedusaContainer).run({
      input: { trigger: "chosen" },
    })
  } catch (failure) {
    logger.warn({ event: "google_reviews.adopt_failed", err: errorSummary(failure) })
  }
}
