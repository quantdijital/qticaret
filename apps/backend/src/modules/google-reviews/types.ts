import type { GoogleReviewInput } from "../../lib/google/business-review"
import type { HideReason } from "./models/google-review"

// What the google-reviews service takes and gives (adr/0058)

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
  hidden_reason: HideReason | null
  hidden_by: string | null
  hidden_at: Date | null
}

/** Off the storefront with one of the reasons and who did it, or back on it. */
export type Visibility = { hidden: true; reason: HideReason; by: string } | { hidden: false }

/** Whether a review is off the storefront, and why, by whom and since when. */
export type VisibilityRow = Pick<ReviewRow, "hidden" | "hidden_reason" | "hidden_by" | "hidden_at">

/** The owner's reply as kept: its text, Google's time and moderation; all null for none. */
export type ReplyRow = Pick<ReviewRow, "reply" | "replied_at" | "reply_state">

/** A review's place at Google, for writing its reply, with the reply kept now. */
export interface ReplyTargetRow extends ReplyRow {
  id: string
  account: string
  location: string
  review_id: string
}

/** Which reviews `newest` lists: the storefront's only shown ones, an excerpt's only rated and written. */
export interface NewestOptions {
  offset?: number
  limit: number
  shownOnly?: boolean
  /** At least these stars, with text (the home page's excerpts). */
  minRating?: number
}
