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
  /** The shop's reply as Google has it, written there or here; null for none. */
  reply: string | null
  replied_at: string | null
  /** Google's moderation of the reply; null when Google gives none (shown). */
  reply_state: ReplyState | null
  hidden: boolean
  /** Why it was taken off the storefront; null while shown. */
  hidden_reason: HideReason | null
  /** Who took it off (their name or address) and when. */
  hidden_by: string | null
  hidden_at: string | null
}

/**
 * The only reasons a Google review may leave the storefront (adr/0058 Ek,
 * the owner 2026-11-05): never its stars.
 */
export const HIDE_REASONS = ["personal_data", "abusive", "off_topic"] as const
export type HideReason = (typeof HIDE_REASONS)[number]

export const GOOGLE_REVIEW_PAGE_SIZE = 20

/** Where Google's moderation has the shop's reply (adr/0058 Ek 2026-11-06). */
export type ReplyState = "pending" | "approved" | "rejected"

/** What Google takes as a reply: plain text, 4096 bytes in UTF-8 (a Turkish letter counts two). */
export const MAX_REPLY_BYTES = 4096

const encoder = new TextEncoder()

/** A reply's length as Google counts it. */
export const replyBytes = (text: string): number => encoder.encode(text).length

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

/**
 * The shop's reply to one Google review, written at Google (created or
 * replaced), or removed there (`comment: null`); kept as Google answered.
 */
export function useGoogleReviewReply() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; comment: string | null }) => {
      const path = `/admin/google/reviews/items/${encodeURIComponent(input.id)}/reply`
      return input.comment === null
        ? sdk.client.fetch(path, { method: "DELETE" })
        : sdk.client.fetch(path, { method: "POST", body: { comment: input.comment } })
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["google-reviews", "items"] })
    },
  })
}

/** One Google review taken off the storefront with its reason, or put back. */
export function useHideGoogleReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (
      input: { id: string; hidden: true; reason: HideReason } | { id: string; hidden: false }
    ) =>
      sdk.client.fetch(`/admin/google/reviews/items/${encodeURIComponent(input.id)}`, {
        method: "POST",
        body: input.hidden ? { hidden: true, reason: input.reason } : { hidden: false },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["google-reviews", "items"] })
    },
  })
}
