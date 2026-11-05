import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The shop's Google reviews from its Business Profile (adr/0058). */
export interface GoogleReviewsStatus {
  /** Whether the platform's Google client is set up at all. */
  configured: boolean
  connected: boolean
  /** Whether the connection carries Business Profile's scope. */
  granted: boolean
  location: {
    account: string
    location: string
    title: string
    address: string | null
    maps_url: string | null
  } | null
  /** Google's own average and count, as the last sync read them. */
  rating: number | null
  count: number | null
  synced_at: string | null
  /** Google's word when the last sync stopped (`http_429`, `PERMISSION_DENIED`, `invalid_grant`). */
  error: string | null
}

export interface GoogleLocation {
  account: string
  location: string
  title: string
  address: string | null
}

export interface GoogleReviewRow {
  id: string
  /** Null for a reviewer who stays anonymous on Google. */
  author: string | null
  rating: number
  comment: string | null
  created_at: string
  replied: boolean
  hidden: boolean
}

export const GOOGLE_REVIEW_PAGE_SIZE = 20

export const googleReviewsQuery = () =>
  queryOptions({
    queryKey: ["google-reviews"],
    queryFn: () =>
      sdk.client.fetch<{ google_reviews: GoogleReviewsStatus }>("/admin/google/reviews"),
  })

/** The Business Profile locations the connected account manages: asked of Google. */
export const googleLocationsQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["google-reviews", "locations"],
    queryFn: () =>
      sdk.client.fetch<{ locations: GoogleLocation[] }>("/admin/google/reviews/locations"),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

export const googleReviewItemsQuery = (page: number, enabled: boolean) =>
  queryOptions({
    queryKey: ["google-reviews", "items", page],
    queryFn: () =>
      sdk.client.fetch<{ reviews: GoogleReviewRow[]; count: number }>(
        "/admin/google/reviews/items",
        { query: { offset: page * GOOGLE_REVIEW_PAGE_SIZE } }
      ),
    enabled,
  })

/** Google's consent screen asking Business Profile's scope on top: the address to go to. */
export const startGoogleReviewsConnect = () =>
  sdk.client.fetch<{ url: string }>("/admin/google/reviews/connect", { method: "POST" })

type Action =
  { kind: "location"; account: string; location: string } | { kind: "sync" } | { kind: "forget" }

/** A sync's outcome (`error`: Google's word when it stopped); none for a removal. */
type ActionAnswer = { sync: { error: string | null } } | { removed: number }

export function useGoogleReviewsAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: Action): Promise<ActionAnswer> =>
      action.kind === "location"
        ? sdk.client.fetch<ActionAnswer>("/admin/google/reviews/location", {
            method: "POST",
            body: { account: action.account, location: action.location },
          })
        : action.kind === "sync"
          ? sdk.client.fetch<ActionAnswer>("/admin/google/reviews/sync", { method: "POST" })
          : sdk.client.fetch<ActionAnswer>("/admin/google/reviews", { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["google-reviews"] })
    },
  })
}

/** A Google review taken off the storefront, or put back. */
export function useHideGoogleReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; hidden: boolean }) =>
      sdk.client.fetch(`/admin/google/reviews/items/${encodeURIComponent(input.id)}`, {
        method: "POST",
        body: { hidden: input.hidden },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["google-reviews", "items"] })
    },
  })
}
