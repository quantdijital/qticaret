import type { LocationRow, NewestOptions, ReplyRow, ReplyTargetRow, Visibility } from "./types"

// How the service shapes what it writes to and reads from its rows

/** A review off the storefront (its reason, who, now), or back on it (the reason, who and when cleared). */
export const visibilityPatch = (id: string, visibility: Visibility) =>
  visibility.hidden
    ? {
        id,
        hidden: true,
        hidden_reason: visibility.reason,
        hidden_by: visibility.by,
        hidden_at: new Date(),
      }
    : { id, hidden: false, hidden_reason: null, hidden_by: null, hidden_at: null }

/** A review's place at Google (the location picked, Google's id) with the reply kept now. */
export const replyTargetOf = (
  row: ReplyRow & { id: string; review_id: string },
  location: Pick<LocationRow, "account" | "location">
): ReplyTargetRow => ({
  id: row.id,
  account: location.account,
  location: location.location,
  review_id: row.review_id,
  reply: row.reply,
  replied_at: row.replied_at,
  reply_state: row.reply_state,
})

/** Which reviews `newest` reads: the storefront's only shown ones, an excerpt's only rated and written. */
export const newestFilters = (options: NewestOptions) => ({
  ...(options.shownOnly ? { hidden: false } : {}),
  ...(options.minRating === undefined
    ? {}
    : { rating: { $gte: options.minRating }, comment: { $ne: null } }),
})
