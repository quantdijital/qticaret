import { isValidationError } from "../../errors"
import { MAX_ATTEMPTS } from "./limits"
import { ProbeStoppedError } from "./probe"
import type { VideoStatus } from "./status"

/**
 * Why a clip could not be made fit for the web (adr/0069 §4), in two
 * classes. An input error (the stream is broken, the clip breaks a limit,
 * its source is gone) fails at once: trying again reads the same bytes.
 * An infrastructure error (a timeout, ffmpeg crashed, storage could not
 * write, the disk is full) is tried again, three times in all, then fails
 * with `video.processing_failed`, the one failure the panel offers
 * "Yeniden dene" for.
 */

export type FailureKind = "input" | "infra"

/** The key the panel reads when the tries are spent. */
export const PROCESSING_FAILED = "video.processing_failed"

export class VideoJobError extends Error {
  override readonly name = "VideoJobError"
  readonly kind: FailureKind
  /** An i18n key (`video.*`): what the panel says. */
  readonly code: string

  constructor(kind: FailureKind, code: string, detail?: string) {
    super(detail ?? code)
    this.kind = kind
    this.code = code
  }
}

/** The job's own failures: a class and the key it records. */
export const inputError = (code: string, detail?: string) =>
  new VideoJobError("input", code, detail)
export const infraError = (detail: string) => new VideoJobError("infra", PROCESSING_FAILED, detail)

export interface Failure {
  kind: FailureKind
  code: string
}

/**
 * Any error the job met, classed. ffprobe's refusal of the clip
 * (`ValidationError`, `video.*`) is the input's; a program that would not
 * start, a busy probe, storage, the disk and anything unforeseen are the
 * infrastructure's: tried again, never blamed on the shop's file.
 */
export function classifyFailure(error: unknown): Failure {
  if (error instanceof VideoJobError) {
    return { kind: error.kind, code: error.code }
  }
  // A probe stopped by its time or a signal: the machine's, tried again (review S7)
  if (error instanceof ProbeStoppedError) {
    return { kind: "infra", code: PROCESSING_FAILED }
  }
  if (isValidationError(error) && error.safeMessage.startsWith("video.")) {
    return { kind: "input", code: error.safeMessage }
  }
  return { kind: "infra", code: PROCESSING_FAILED }
}

export interface AfterFailure {
  status: Extract<VideoStatus, "uploaded" | "failed">
  attempts: number
  error_code: string | null
}

/**
 * Where a video goes after a failed try, `attempts` being the tries made
 * before this one: an input error fails now with its own key; an
 * infrastructure error goes back to the queue until the third try, then
 * fails with `video.processing_failed`. The three are counted from
 * `retryFrom` (`attempts` when the shop last pressed "Yeniden dene"):
 * `attempts` itself only rises, since it fences a job's claim.
 */
export function afterFailure(attempts: number, failure: Failure, retryFrom = 0): AfterFailure {
  const made = attempts + 1
  if (failure.kind === "input") {
    return { status: "failed", attempts: made, error_code: failure.code }
  }
  return triesSinceRetry(made, retryFrom) >= MAX_ATTEMPTS
    ? { status: "failed", attempts: made, error_code: PROCESSING_FAILED }
    : { status: "uploaded", attempts: made, error_code: null }
}

/** The tries counted against the cap: those made since the last retry (never below 0). */
export const triesSinceRetry = (attempts: number, retryFrom: number): number =>
  Math.max(0, attempts - Math.max(0, retryFrom))
