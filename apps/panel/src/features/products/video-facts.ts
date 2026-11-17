import type { ProductVideo, VideoStatus } from "@/features/products/api/videos"

/** What the panel says of a product video (adr/0069 §10): its state, its failure, its size. */

const V = "products.videos"
const PROCESSING_FAILED = "video.processing_failed"
// The server's limit (adr/0069 §1)
export const VIDEO_TITLE_MAX = 200

// Every failure a clip can show (the job's and the upload's keys, adr/0069 §3, §4)
const FAILURES = new Set([
  "video.too_large",
  "video.too_long",
  "video.unsupported_type",
  "video.dimensions_too_large",
  "video.frame_rate_too_high",
  "video.unreadable",
  PROCESSING_FAILED,
])

/** The tile's word for a state: none once it is ready. */
export function videoTileLabel(status: VideoStatus): "processing" | "failed" | null {
  if (status === "failed") {
    return "failed"
  }
  return status === "ready" ? null : "processing"
}

/** A failed clip's sentence, by its key; one the panel does not know reads as the job's. */
export function videoErrorKey(code: string | null): string {
  const known = code !== null && FAILURES.has(code) ? code : PROCESSING_FAILED
  return `${V}.errors.${known.slice("video.".length)}`
}

/**
 * Whether the dialog offers "Yeniden dene": only for a failure of the
 * infrastructure, while the server still keeps the file.
 */
export const offersRetry = (video: Pick<ProductVideo, "status" | "error_code" | "retryable">) =>
  video.status === "failed" && video.error_code === PROCESSING_FAILED && video.retryable !== false

/** The infrastructure's failure whose file is gone: only removing and uploading again helps. */
export const sourceGone = (video: Pick<ProductVideo, "status" | "error_code" | "retryable">) =>
  video.status === "failed" && video.error_code === PROCESSING_FAILED && video.retryable === false

/** 0:12, 1:05: a clip's length as a player shows it. */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`
}

/** 720 × 1280, or null while it is not known. */
export const formatDimensions = (video: Pick<ProductVideo, "width" | "height">) =>
  video.width && video.height ? `${String(video.width)} × ${String(video.height)}` : null

/** "0:12 · 720 × 1280": the dialog's line under its title. */
export function videoFacts(video: Pick<ProductVideo, "duration_ms" | "width" | "height">): string {
  return [video.duration_ms ? formatDuration(video.duration_ms) : null, formatDimensions(video)]
    .filter(Boolean)
    .join(" · ")
}
