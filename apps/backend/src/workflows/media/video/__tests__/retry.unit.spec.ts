import {
  FAILED_SOURCE_KEPT_MS,
  MAX_ATTEMPTS,
  RETRY_MARGIN_MS,
  retryKeptSince,
} from "../../../../lib/media/video/limits"
import {
  PROCESSING_FAILED,
  afterFailure,
  triesSinceRetry,
} from "../../../../lib/media/video/transcode-errors"
import { retryRefusal } from "../edit"
import { canRetryVideo } from "../read"

/**
 * "Yeniden dene" (adr/0069 §10, slice 3): `attempts` never goes down (it
 * fences a job's claim, §4 note), so the three tries count from
 * `retry_from`, the tries made when the shop pressed it.
 */
describe("a retried clip's tries", () => {
  const infra = { kind: "infra" as const, code: PROCESSING_FAILED }

  it("counts only the tries since the last retry", () => {
    expect(triesSinceRetry(3, 0)).toBe(3)
    expect(triesSinceRetry(3, 3)).toBe(0)
    expect(triesSinceRetry(5, 3)).toBe(2)
    // Never below none, whatever a row holds
    expect(triesSinceRetry(2, 5)).toBe(0)
    expect(triesSinceRetry(2, -1)).toBe(2)
  })

  it("gives a clip retried after three failed tries three more, with attempts still rising", () => {
    // Failed on its third try, then retried: retry_from = 3
    expect(afterFailure(3, infra, 3)).toEqual({ status: "uploaded", attempts: 4, error_code: null })
    expect(afterFailure(4, infra, 3)).toEqual({ status: "uploaded", attempts: 5, error_code: null })
    expect(afterFailure(5, infra, 3)).toEqual({
      status: "failed",
      attempts: 6,
      error_code: PROCESSING_FAILED,
    })
    // Retried again at 6: three more again
    expect(afterFailure(6, infra, 6).status).toBe("uploaded")
    expect(afterFailure(8, infra, 6).status).toBe("failed")
  })

  it("keeps the first run's cap where no retry was made", () => {
    for (let tried = 0; tried < MAX_ATTEMPTS - 1; tried++) {
      expect(afterFailure(tried, infra).status).toBe("uploaded")
    }
    expect(afterFailure(MAX_ATTEMPTS - 1, infra).status).toBe("failed")
  })

  it("still fails an input error at once after a retry", () => {
    expect(afterFailure(3, { kind: "input", code: "video.unreadable" }, 3)).toEqual({
      status: "failed",
      attempts: 4,
      error_code: "video.unreadable",
    })
  })
})

describe("which videos may be retried", () => {
  const now = Date.UTC(2026, 10, 17, 12)
  const failed = {
    kind: "upload" as const,
    status: "failed" as const,
    error_code: PROCESSING_FAILED,
    source_file_id: "video-kaynak.mov",
    failed_at: new Date(now - 60_000) as Date | null,
  }

  it("takes a clip the infrastructure failed while its source is kept", () => {
    expect(canRetryVideo(failed, now)).toBe(true)
  })

  it("refuses an input failure, any other state, a YouTube video and a swept source", () => {
    expect(canRetryVideo({ ...failed, error_code: "video.unreadable" }, now)).toBe(false)
    expect(canRetryVideo({ ...failed, status: "ready" }, now)).toBe(false)
    expect(canRetryVideo({ ...failed, status: "processing" }, now)).toBe(false)
    expect(canRetryVideo({ ...failed, kind: "youtube" }, now)).toBe(false)
    expect(canRetryVideo({ ...failed, source_file_id: null }, now)).toBe(false)
    // A failure without its time is never retried on a guess
    expect(canRetryVideo({ ...failed, failed_at: null }, now)).toBe(false)
  })

  it("stops an hour before the sweep may remove a week-old failure's source", () => {
    expect(retryKeptSince(now).getTime()).toBe(now - FAILED_SOURCE_KEPT_MS + RETRY_MARGIN_MS)
    const edge = now - FAILED_SOURCE_KEPT_MS + RETRY_MARGIN_MS
    expect(canRetryVideo({ ...failed, failed_at: new Date(edge + 1) }, now)).toBe(true)
    expect(canRetryVideo({ ...failed, failed_at: new Date(edge) }, now)).toBe(false)
  })

  it("names why a refused retry was refused", () => {
    expect(retryRefusal(failed)).toBe("video.source_gone")
    expect(retryRefusal({ ...failed, error_code: "video.too_long" })).toBe(
      "video.retry_unavailable"
    )
    expect(retryRefusal({ ...failed, status: "ready" })).toBe("video.retry_unavailable")
  })
})
