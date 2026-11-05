import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BUSINESS_PROFILE_SCOPE, googleClientOf, hasScope } from "../../lib/google/oauth"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import type { LocationRow, ReviewRow } from "../../modules/google-reviews/service"
import { googleReviewsOf } from "./reviews"
import { GOOGLE_CONTENT_MAX_DAYS } from "./reviews-sync"

type Resolver = Pick<MedusaContainer, "resolve">

const DAY_MS = 24 * 60 * 60 * 1000

/** Google's average to one decimal, as Google itself shows it. */
const oneDecimal = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10

const iso = (value: Date | string | null): string | null =>
  value === null ? null : new Date(value).toISOString()

/** Whether what the location holds is recent enough to show (Google's 30-day storage limit). */
const fresh = (location: LocationRow, now: Date): boolean =>
  location.synced_at !== null &&
  now.getTime() - new Date(location.synced_at).getTime() < GOOGLE_CONTENT_MAX_DAYS * DAY_MS

/**
 * The panel's Google reviews (adr/0058): whether the platform's Google
 * client is set up, the shop's connection and its Business Profile scope,
 * the location picked, Google's average and count, the last sync. No token.
 */
export async function googleReviewsStatus(container: Resolver) {
  const [status] = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .describeAll()
    .then((all) => all.filter((each) => each.provider === "google"))
  const location = await googleReviewsOf(container).currentLocation()
  return {
    configured: googleClientOf() !== null,
    connected: status !== undefined && status.state !== "not_configured",
    granted: hasScope(status?.settings?.["scopes"], BUSINESS_PROFILE_SCOPE),
    location: location
      ? {
          account: location.account,
          location: location.location,
          title: location.title,
          address: location.address,
          maps_url: location.maps_uri,
        }
      : null,
    rating: oneDecimal(location?.average_rating ?? null),
    count: location?.total_review_count ?? null,
    synced_at: iso(location?.synced_at ?? null),
    error: location?.sync_error ?? null,
  }
}

const panelReview = (review: ReviewRow, names: ReadonlyMap<string, string>) => ({
  id: review.id,
  author: review.reviewer_name,
  rating: review.rating,
  comment: review.comment,
  created_at: iso(review.written_at),
  replied: review.reply !== null,
  hidden: review.hidden,
  // Why, by whom and when it was taken off the storefront (adr/0058 Ek)
  hidden_reason: review.hidden ? review.hidden_reason : null,
  hidden_by: review.hidden && review.hidden_by ? (names.get(review.hidden_by) ?? null) : null,
  hidden_at: review.hidden ? iso(review.hidden_at) : null,
})

/** Staff members' names (or addresses) by id, for who took a review off. */
async function staffNames(container: Resolver, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "user",
    fields: ["id", "first_name", "last_name", "email"],
    filters: { id: ids },
  })
  return new Map(
    data.map((user) => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
      return [user.id, name === "" ? user.email : name] as const
    })
  )
}

/** The Google reviews kept, newest first, twenty a page, each hidden one with why and by whom. */
export async function panelGoogleReviews(container: Resolver, offset: number) {
  const { reviews, count } = await googleReviewsOf(container).newest({ offset, limit: 20 })
  const names = await staffNames(container, [
    ...new Set(reviews.flatMap((review) => (review.hidden_by ? [review.hidden_by] : []))),
  ])
  return { reviews: reviews.map((review) => panelReview(review, names)), count, limit: 20, offset }
}

/**
 * The storefront's Google reviews (adr/0058): the location's name, Google's
 * own average and count, its Maps and "write a review" links, and the
 * newest reviews the shop did not hide, each with the owner's reply. Null
 * with no location, before the first sync and once what was kept is past
 * Google's 30 days.
 */
export async function storefrontGoogleReviews(
  container: Resolver,
  limit: number,
  now = new Date()
) {
  const reviews = googleReviewsOf(container)
  const location = await reviews.currentLocation()
  if (!location || !fresh(location, now)) {
    return null
  }
  const shown = (await reviews.newest({ limit, shownOnly: true })).reviews
  if (!location.total_review_count && shown.length === 0) {
    return null
  }
  return {
    title: location.title,
    rating: oneDecimal(location.average_rating),
    count: location.total_review_count ?? 0,
    maps_url: location.maps_uri,
    write_url: location.new_review_uri,
    reviews: shown.map((review) => ({
      id: review.id,
      author: review.reviewer_name,
      photo_url: review.reviewer_photo_url,
      rating: review.rating,
      comment: review.comment,
      created_at: iso(review.written_at),
      reply: review.reply ? { comment: review.reply, created_at: iso(review.replied_at) } : null,
    })),
  }
}
