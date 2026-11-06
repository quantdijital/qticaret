import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError, isProviderError } from "../../lib/errors"
import { businessReplyApi } from "../../lib/google/business-reply"
import type { ReplyTarget } from "../../lib/google/business-reply"
import { errorSummary, logger } from "../../lib/logging"
import type { ReplyRow } from "../../modules/google-reviews/service"
import { businessProfileToken, googleReviewsOf } from "./reviews"

/**
 * The owner's reply to one Google review from the panel (adr/0058 Ek
 * 2026-11-06): written at Google first (Business Profile API v4
 * `updateReply`/`deleteReply`), then kept here as Google answered it.
 * Should keeping it fail, Google gets the reply it had before (or none)
 * back. The route's audit entry records it (`google_review`).
 */

export type ReplyGoogleReviewInput =
  { id: string; comment: string; user_id: string } | { id: string; comment: null; user_id: string }

/** Google's refusals the shop can act on, by Google's `error.status` (or the client's `http_…`). */
const REFUSALS: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: "google.reply_forbidden",
  FAILED_PRECONDITION: "google.reply_unverified",
  INVALID_ARGUMENT: "google.reply_refused",
  NOT_FOUND: "google.review_not_found",
  RESOURCE_EXHAUSTED: "google.reply_unavailable",
  UNAVAILABLE: "google.reply_unavailable",
  http_429: "google.reply_unavailable",
  http_503: "google.reply_unavailable",
}

// The platform's to look at (the API not approved: 0 a minute), not the shop's
const PLATFORM_SIDE = new Set(["RESOURCE_EXHAUSTED", "http_429"])

/** Google's refusal in the shop's words; anything else as it came. */
function refusalOf(failure: unknown, action: "update" | "delete"): unknown {
  if (!isProviderError(failure)) {
    return failure
  }
  const code = failure.providerCode
  const fields = { event: "google_reviews.reply_failed", action, code }
  if (PLATFORM_SIDE.has(code)) {
    logger.error(fields)
  } else {
    logger.warn(fields)
  }
  const key = Object.hasOwn(REFUSALS, code) ? REFUSALS[code] : undefined
  return key ? new ValidationError(key, { field: "comment" }) : failure
}

/** The reply as Google now has it (all null: none), its time as text between steps. */
interface WrittenReply {
  reply: string | null
  replied_at: string | null
  reply_state: ReplyRow["reply_state"]
}

interface RemoteResult {
  target: ReplyTarget
  reply: WrittenReply
}

interface RemoteUndo {
  target: ReplyTarget
  /** The reply Google had before, to put back. */
  previous: string | null
}

/** Writes the reply at Google (or removes it); undone by putting back what Google had. */
const writeGoogleReplyStep = createStep(
  "google-reviews-reply-remote",
  async (input: ReplyGoogleReviewInput, { container }) => {
    const kept = await googleReviewsOf(container).replyTarget(input.id)
    if (!kept) {
      throw new ValidationError("google.review_not_found")
    }
    if (input.comment === null && kept.reply === null) {
      throw new ValidationError("google.reply_missing")
    }
    const target: ReplyTarget = {
      account: kept.account,
      location: kept.location,
      review_id: kept.review_id,
    }
    const token = await businessProfileToken(container)
    const api = businessReplyApi()
    let reply: WrittenReply
    try {
      if (input.comment === null) {
        await api.deleteReply(token, target)
        reply = { reply: null, replied_at: null, reply_state: null }
      } else {
        const answer = await api.updateReply(token, target, input.comment)
        reply = {
          reply: answer.comment,
          replied_at: (answer.updated_at ?? new Date()).toISOString(),
          reply_state: answer.state,
        }
      }
    } catch (failure) {
      throw refusalOf(failure, input.comment === null ? "delete" : "update")
    }
    return new StepResponse<RemoteResult, RemoteUndo>(
      { target, reply },
      { target, previous: kept.reply }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    try {
      const token = await businessProfileToken(container)
      const api = businessReplyApi()
      if (undo.previous === null) {
        await api.deleteReply(token, undo.target)
      } else {
        await api.updateReply(token, undo.target, undo.previous)
      }
      logger.warn({ event: "google_reviews.reply_restored", had: undo.previous !== null })
    } catch (failure) {
      // Google keeps the new reply; the next sync brings it here as Google has it
      logger.error({ event: "google_reviews.reply_restore_failed", err: errorSummary(failure) })
      throw failure
    }
  }
)

/** Keeps the reply as Google answered it; undone by keeping the one before. */
const keepReplyStep = createStep(
  "google-reviews-reply-keep",
  async (input: { id: string; reply: WrittenReply }, { container }) => {
    const { reply, replied_at, reply_state } = input.reply
    const previous = await googleReviewsOf(container).setReply(input.id, {
      reply,
      replied_at: replied_at ? new Date(replied_at) : null,
      reply_state,
    })
    if (!previous) {
      throw new ValidationError("google.review_not_found")
    }
    return new StepResponse({ id: input.id, ...input.reply }, { id: input.id, previous })
  },
  async (undo, { container }) => {
    if (undo) {
      const { reply, replied_at, reply_state } = undo.previous
      await googleReviewsOf(container).setReply(undo.id, {
        reply,
        replied_at: replied_at ? new Date(replied_at) : null,
        reply_state,
      })
    }
  }
)

export const replyGoogleReviewWorkflow = createWorkflow(
  "google-reviews-reply",
  (input: ReplyGoogleReviewInput) => {
    const remote = writeGoogleReplyStep(input)
    const kept = keepReplyStep({ id: input.id, reply: remote.reply })
    return new WorkflowResponse(kept)
  }
)
