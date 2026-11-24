import { z } from "@medusajs/framework/zod"
import type { ReplyState } from "../../modules/google-reviews/models/google-review"
import { createHttpClient } from "../clients"
import type { HttpClient, HttpClientOptions } from "../clients"
import { isAccountName, isLocationName } from "./business-profile"
import { replyStateOf } from "./business-review"
import { GOOGLE_PROVIDER, googleHosts } from "./oauth"
import { registerProcessCache } from "../cache/process-caches"

/**
 * The owner's reply to one Google review (adr/0058 Ek 2026-11-06), as
 * Google My Business API v4 takes it (checked against its reference,
 * 2026-11-06): `PUT /v4/{accounts/*\/locations/*\/reviews/*}/reply` with a
 * `ReviewReply` (`comment`, plain text, at most 4096 bytes) creates the
 * reply or replaces it and answers the `ReviewReply` (`comment`,
 * `updateTime`, `reviewReplyState`); `DELETE` the same path removes it
 * (an empty body, `{}`). Both need `business.manage` and a verified
 * location. A refusal carries Google's `error.status`.
 */

const apiError = (body: unknown): string | undefined => {
  const status = (body as { error?: { status?: unknown } } | null)?.error?.status
  return typeof status === "string" ? status : undefined
}

// Google's review ids: letters, digits and a few marks; nothing that bends a path
const REVIEW_ID = /^[\w.~-]{1,512}$/

const ReviewReply = z.looseObject({
  comment: z.string().optional(),
  updateTime: z.string().optional(),
  reviewReplyState: z.string().optional(),
})

/** Where the reply is: the account it is reached through, the location, Google's review id. */
export interface ReplyTarget {
  account: string
  location: string
  review_id: string
}

/** The reply as Google now has it. */
export interface GoogleReply {
  comment: string
  /** Google's own time; null when it gave none. */
  updated_at: Date | null
  state: ReplyState | null
}

function pathOf(target: ReplyTarget): string[] {
  if (
    !isAccountName(target.account) ||
    !isLocationName(target.location) ||
    !REVIEW_ID.test(target.review_id)
  ) {
    throw new Error("google: not a Business Profile review")
  }
  // Segments encoded one by one: `accounts/1/locations/2/reviews/x/reply`
  return [
    "v4",
    ...target.account.split("/"),
    ...target.location.split("/"),
    "reviews",
    target.review_id,
    "reply",
  ]
}

const dateOf = (value: string | undefined): Date | null => {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date : null
}

export function createBusinessReplyApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> = {}
) {
  const client: HttpClient = createHttpClient({
    ...options,
    baseUrl: googleHosts().myBusiness,
    provider: GOOGLE_PROVIDER,
    errorCode: apiError,
  })
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

  /** Writes the owner's reply (creating or replacing it); the reply as Google keeps it. */
  async function updateReply(
    token: string,
    target: ReplyTarget,
    comment: string
  ): Promise<GoogleReply> {
    const answer = await client.request({
      method: "PUT",
      path: pathOf(target),
      logPath: "/v4/:account/:location/reviews/:review/reply",
      headers: bearer(token),
      json: { comment },
      schema: ReviewReply,
    })
    const said = answer.comment?.trim()
    return {
      // An answer without the text (it is optional there) is the text sent
      comment: said === undefined || said === "" ? comment : said,
      updated_at: dateOf(answer.updateTime),
      state: replyStateOf(answer.reviewReplyState),
    }
  }

  /** Removes the owner's reply. */
  async function deleteReply(token: string, target: ReplyTarget): Promise<void> {
    await client.request({
      method: "DELETE",
      path: pathOf(target),
      logPath: "/v4/:account/:location/reviews/:review/reply",
      headers: bearer(token),
      schema: z.unknown(),
    })
  }

  return { updateReply, deleteReply }
}

export type BusinessReplyApi = ReturnType<typeof createBusinessReplyApi>

let shared: { key: string; api: BusinessReplyApi } | undefined
// A new client (and circuit breaker) per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** One client per host (a fake server's in tests). */
export function businessReplyApi(): BusinessReplyApi {
  const key = googleHosts().myBusiness
  if (shared?.key !== key) {
    shared = { key, api: createBusinessReplyApi() }
  }
  return shared.api
}

/** The UTF-8 length Google counts a reply in. */
export const replyBytes = (comment: string): number => Buffer.byteLength(comment, "utf8")
