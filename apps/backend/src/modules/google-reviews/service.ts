import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import type { GoogleReviewInput } from "../../lib/google/business-review"
import { GoogleReview } from "./models/google-review"
import { GoogleReviewLocation } from "./models/google-review-location"

/** The location the shop picked, as the panel listed it from Google. */
export interface LocationInput {
  account: string
  location: string
  title: string
  address: string | null
  maps_uri: string | null
  new_review_uri: string | null
}

export interface SyncInput {
  account: string
  location: string
  average_rating: number | null
  total_review_count: number | null
  reviews: GoogleReviewInput[]
  /** Every review Google has was read: those kept and not among them are gone there. */
  complete: boolean
}

export interface SyncCounts {
  added: number
  updated: number
  removed: number
}

export interface LocationRow extends LocationInput {
  id: string
  average_rating: number | null
  total_review_count: number | null
  synced_at: Date | null
  sync_error: string | null
  created_at: Date
}

export interface ReviewRow extends GoogleReviewInput {
  id: string
  hidden: boolean
}

const REVIEW_FIELDS = [
  "id",
  "review_id",
  "reviewer_name",
  "reviewer_photo_url",
  "rating",
  "comment",
  "written_at",
  "edited_at",
  "reply",
  "replied_at",
  "hidden",
] as const

const time = (value: Date | string | null): number | null =>
  value === null ? null : new Date(value).getTime()

/** Whether Google's review differs from the one kept, the shop's `hidden` aside. */
const changed = (kept: ReviewRow, now: GoogleReviewInput): boolean =>
  kept.reviewer_name !== now.reviewer_name ||
  kept.reviewer_photo_url !== now.reviewer_photo_url ||
  kept.rating !== now.rating ||
  kept.comment !== now.comment ||
  kept.reply !== now.reply ||
  time(kept.written_at) !== time(now.written_at) ||
  time(kept.edited_at) !== time(now.edited_at) ||
  time(kept.replied_at) !== time(now.replied_at)

/** The shop's Google reviews (adr/0058): the location picked and its reviews as Google gives them. */
class GoogleReviewsModuleService extends MedusaService({ GoogleReviewLocation, GoogleReview }) {
  /** The location picked; null while none is. */
  @InjectManager()
  async currentLocation(@MedusaContext() sharedContext: Context = {}): Promise<LocationRow | null> {
    const [row] = await this.listGoogleReviewLocations(
      {},
      { take: 1, order: { created_at: "DESC" } },
      sharedContext
    )
    return (row as LocationRow | undefined) ?? null
  }

  /**
   * Picks the location: another one than before forgets the reviews kept
   * (they are another place's); the same one only takes its new title,
   * address and links.
   */
  @InjectTransactionManager()
  async chooseLocation(
    input: LocationInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ changed: boolean }> {
    await this.lock(sharedContext)
    const rows = await this.listGoogleReviewLocations({}, { take: null }, sharedContext)
    const same = rows.find(
      (row) => row.account === input.account && row.location === input.location
    )
    if (same && rows.length === 1) {
      await this.updateGoogleReviewLocations({ id: same.id, ...input }, sharedContext)
      return { changed: false }
    }
    await this.forget(sharedContext)
    await this.createGoogleReviewLocations(input, sharedContext)
    return { changed: true }
  }

  /** Forgets the location and every review kept: the shop disconnected. How many reviews went. */
  @InjectTransactionManager()
  async forgetAll(@MedusaContext() sharedContext: Context = {}): Promise<number> {
    await this.lock(sharedContext)
    return this.forget(sharedContext)
  }

  /**
   * Keeps what Google gave in one sync: new reviews added, changed ones
   * updated (the shop's `hidden` stays), and, when every page was read,
   * those Google no longer has removed. Null when the location changed
   * meanwhile: nothing is written for a place no longer picked.
   */
  @InjectTransactionManager()
  async applySync(
    input: SyncInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SyncCounts | null> {
    await this.lock(sharedContext)
    const location = await this.currentLocation(sharedContext)
    if (location?.account !== input.account || location.location !== input.location) {
      return null
    }
    const kept = new Map(
      (
        (await this.listGoogleReviews(
          {},
          { select: [...REVIEW_FIELDS], take: null },
          sharedContext
        )) as ReviewRow[]
      ).map((row) => [row.review_id, row])
    )
    const seen = new Set<string>()
    const added: GoogleReviewInput[] = []
    const updated: (GoogleReviewInput & { id: string })[] = []
    for (const review of input.reviews) {
      if (seen.has(review.review_id)) {
        continue
      }
      seen.add(review.review_id)
      const row = kept.get(review.review_id)
      if (!row) {
        added.push(review)
      } else if (changed(row, review)) {
        updated.push({ ...review, id: row.id })
      }
    }
    const gone = input.complete
      ? [...kept.values()].filter((row) => !seen.has(row.review_id)).map((row) => row.id)
      : []
    if (added.length > 0) {
      await this.createGoogleReviews(added, sharedContext)
    }
    if (updated.length > 0) {
      await this.updateGoogleReviews(updated, sharedContext)
    }
    if (gone.length > 0) {
      await this.deleteGoogleReviews(gone, sharedContext)
    }
    await this.updateGoogleReviewLocations(
      {
        id: location.id,
        average_rating: input.average_rating,
        total_review_count: input.total_review_count,
        synced_at: new Date(),
        sync_error: null,
      },
      sharedContext
    )
    return { added: added.length, updated: updated.length, removed: gone.length }
  }

  /** Notes why the last sync of the location stopped; what was kept stays until it is too old. */
  @InjectTransactionManager()
  async recordSyncError(
    location: string,
    error: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const current = await this.currentLocation(sharedContext)
    if (current?.location === location) {
      await this.updateGoogleReviewLocations(
        { id: current.id, sync_error: error.slice(0, 100) },
        sharedContext
      )
    }
  }

  /**
   * Forgets the reviews, the average and the count when the last whole
   * sync is older than `before` (Google's policy: stored content at most
   * 30 days); the location picked stays, for the next sync. How many went.
   */
  @InjectTransactionManager()
  async purgeStale(before: Date, @MedusaContext() sharedContext: Context = {}): Promise<number> {
    await this.lock(sharedContext)
    const location = await this.currentLocation(sharedContext)
    const at = location ? (location.synced_at ?? location.created_at) : null
    if (!location || !at || new Date(at) >= before) {
      return 0
    }
    const removed = await this.deleteReviews(sharedContext)
    if (location.average_rating !== null || location.total_review_count !== null) {
      await this.updateGoogleReviewLocations(
        { id: location.id, average_rating: null, total_review_count: null },
        sharedContext
      )
    }
    return removed
  }

  /** Takes a review off the storefront, or puts it back; false for one no longer kept. */
  @InjectTransactionManager()
  async setHidden(
    id: string,
    hidden: boolean,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const [row] = await this.listGoogleReviews({ id }, { select: ["id"], take: 1 }, sharedContext)
    if (!row) {
      return false
    }
    await this.updateGoogleReviews({ id, hidden }, sharedContext)
    return true
  }

  /** The reviews kept, newest written first; the storefront's only those not hidden. */
  @InjectManager()
  async newest(
    options: { offset?: number; limit: number; shownOnly?: boolean },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ reviews: ReviewRow[]; count: number }> {
    const [rows, count] = await this.listAndCountGoogleReviews(
      options.shownOnly ? { hidden: false } : {},
      {
        select: [...REVIEW_FIELDS],
        order: { written_at: "DESC", id: "ASC" },
        skip: options.offset ?? 0,
        take: options.limit,
      },
      sharedContext
    )
    return { reviews: rows, count }
  }

  // One change to the reviews at a time: the schedule's sync and the panel's
  private async lock(sharedContext: Context): Promise<void> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("google-reviews: changes are made in a transaction")
    }
    await manager.execute(`SELECT pg_advisory_xact_lock(hashtext('google_reviews:sync'))`, [])
  }

  private async deleteReviews(sharedContext: Context): Promise<number> {
    const rows = await this.listGoogleReviews({}, { select: ["id"], take: null }, sharedContext)
    if (rows.length > 0) {
      await this.deleteGoogleReviews(
        rows.map(({ id }) => id),
        sharedContext
      )
    }
    return rows.length
  }

  private async forget(sharedContext: Context): Promise<number> {
    const removed = await this.deleteReviews(sharedContext)
    const locations = await this.listGoogleReviewLocations(
      {},
      { select: ["id"], take: null },
      sharedContext
    )
    if (locations.length > 0) {
      await this.deleteGoogleReviewLocations(
        locations.map(({ id }) => id),
        sharedContext
      )
    }
    return removed
  }
}

export default GoogleReviewsModuleService
