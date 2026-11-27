import { z } from "@medusajs/framework/zod"
import type { ReplyState } from "../../modules/google-reviews/models/google-review"

/**
 * One Google review as Business Profile's v4 `Review` gives it (adr/0058),
 * made what we keep: Google's id, the reviewer as Google shows them (an
 * anonymous one without a photo), the stars 1 to 5, the text, when it was
 * written and changed, and the owner's reply with where Google's moderation
 * has it (adr/0058 Ek 2026-11-06): the panel shows a waiting or refused one
 * to the shop, the storefront only one Google shows (`replyShown`).
 */

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const

/** What a review's text and the owner's reply may run to here (Google: 4096 bytes a reply). */
export const MAX_COMMENT = 5000

/** What Google takes as the owner's reply: plain text, 4096 bytes in UTF-8 (`ReviewReply.comment`). */
export const MAX_REPLY_BYTES = 4096

const REPLY_STATES: Readonly<Record<string, ReplyState>> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
}

/** Google's `reviewReplyState` as kept; none (or `UNSPECIFIED`) is null: shown. */
export const replyStateOf = (value: string | undefined): ReplyState | null =>
  (value !== undefined && Object.hasOwn(REPLY_STATES, value) ? REPLY_STATES[value] : null) ?? null

/** Whether the storefront shows a reply: Google shows it (approved, or no state given). */
export const replyShown = (state: ReplyState | null): boolean =>
  state === null || state === "approved"

const Raw = z.looseObject({
  name: z.string().optional(),
  reviewId: z.string().optional(),
  reviewer: z
    .looseObject({
      displayName: z.string().optional(),
      profilePhotoUrl: z.string().optional(),
      isAnonymous: z.boolean().optional(),
    })
    .optional(),
  starRating: z.string().optional(),
  comment: z.string().optional(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
  // Not in the v4 reference, but in Google's answers: the review's page in Business Profile
  reviewReplyUrl: z.string().optional(),
  reviewReply: z
    .looseObject({
      comment: z.string().optional(),
      updateTime: z.string().optional(),
      reviewReplyState: z.string().optional(),
    })
    .optional(),
})

export interface GoogleReviewInput {
  review_id: string
  reviewer_name: string | null
  reviewer_photo_url: string | null
  rating: number
  comment: string | null
  written_at: Date
  edited_at: Date
  reply: string | null
  replied_at: Date | null
  reply_state: ReplyState | null
  /** The review's id on Google Maps (`reviewReplyUrl`'s last part), for its link; null when Google gives none. */
  maps_review_id: string | null
}

const REVIEW_ID = /^[\w.~-]{1,512}$/
// Google's photo hosts only: the storefront draws the picture
const PHOTO_HOST = /^(?:[\w-]+\.)*(?:googleusercontent\.com|ggpht\.com)$/

const dateOf = (value: string | undefined): Date | null => {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date : null
}

const textOf = (value: string | undefined, max: number): string | null => {
  const text = value?.trim() ?? ""
  return text === "" ? null : text.slice(0, max)
}

/**
 * A reviewer's photo on Google's own hosts over https, or null.
 * `fakeOrigin`: a fake Google's own address (development and tests only).
 */
export function photoOf(value: string | undefined, fakeOrigin?: string): string | null {
  if (!value || value.length > 2000) {
    return null
  }
  try {
    const url = new URL(value)
    const google = url.protocol === "https:" && PHOTO_HOST.test(url.hostname)
    return google || (fakeOrigin !== undefined && url.origin === fakeOrigin) ? url.toString() : null
  } catch {
    return null
  }
}

// Maps' review id: base64url of a short protobuf (`Ci9DQUlRQUNv…EAE`, `ChZDSUhNMG9n…EAE`)
const MAPS_REVIEW_ID = /^[A-Za-z0-9_-]{16,512}$/

/**
 * The review's id on Google Maps, from the address Business Profile gives
 * as `reviewReplyUrl` (`https://business.google.com/n/{location}/reviews/{id}`):
 * the same id Maps names the review by in its link, unlike the API's
 * encrypted `reviewId` (adr/0058 Ek 2026-11-27). Null for anything else.
 */
export function mapsReviewIdOf(value: string | undefined): string | null {
  if (!value || value.length > 2000) {
    return null
  }
  try {
    const url = new URL(value)
    const parts = url.pathname.split("/").filter(Boolean)
    const id = parts.at(-1) ?? ""
    return url.protocol === "https:" &&
      url.hostname === "business.google.com" &&
      parts.at(-2) === "reviews" &&
      MAPS_REVIEW_ID.test(id)
      ? id
      : null
  } catch {
    return null
  }
}

/** A review as kept; null for one without a star rating, an id or a date (none is shown). */
export function reviewOf(value: unknown, photoOrigin?: string): GoogleReviewInput | null {
  const parsed = Raw.safeParse(value)
  if (!parsed.success) {
    return null
  }
  const raw = parsed.data
  const id = raw.reviewId ?? raw.name?.split("/").pop() ?? ""
  const rating = STARS[raw.starRating as keyof typeof STARS] as number | undefined
  const written = dateOf(raw.createTime)
  if (!REVIEW_ID.test(id) || rating === undefined || !written) {
    return null
  }
  const reply = raw.reviewReply
  const replyText = reply ? textOf(reply.comment, MAX_COMMENT) : null
  // An anonymous reviewer's name is no name (Google fills it only for the others)
  const anonymous = raw.reviewer?.isAnonymous === true
  return {
    review_id: id,
    reviewer_name: anonymous ? null : textOf(raw.reviewer?.displayName, 200),
    reviewer_photo_url: anonymous ? null : photoOf(raw.reviewer?.profilePhotoUrl, photoOrigin),
    rating,
    comment: textOf(raw.comment, MAX_COMMENT),
    written_at: written,
    edited_at: dateOf(raw.updateTime) ?? written,
    reply: replyText,
    replied_at: replyText ? (dateOf(reply?.updateTime) ?? null) : null,
    reply_state: replyText ? replyStateOf(reply?.reviewReplyState) : null,
    maps_review_id: mapsReviewIdOf(raw.reviewReplyUrl),
  }
}
