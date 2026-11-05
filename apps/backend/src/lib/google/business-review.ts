import { z } from "@medusajs/framework/zod"

/**
 * One Google review as Business Profile's v4 `Review` gives it (adr/0058),
 * made what we keep: Google's id, the reviewer as Google shows them (an
 * anonymous one without a photo), the stars 1 to 5, the text, when it was
 * written and changed, and the owner's reply once Google shows it (a reply
 * waiting for or refused by Google's moderation is not shown there either).
 */

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const

/** What a review's text and the owner's reply may run to here (Google: 4096 bytes a reply). */
export const MAX_COMMENT = 5000

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
  const shown = reply && (!reply.reviewReplyState || reply.reviewReplyState === "APPROVED")
  const replyText = shown ? textOf(reply.comment, MAX_COMMENT) : null
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
  }
}
