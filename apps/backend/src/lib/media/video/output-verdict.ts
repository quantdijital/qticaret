import { z } from "@medusajs/framework/zod"
import { OUTPUT_MAX_DURATION_MS, OUTPUT_SHORT_EDGE } from "./limits"
import { decimalOf } from "./probe-verdict"
import type { OutputKind } from "./transcode-args"
import { OUTPUT_DEMUXER } from "./transcode-args"
import { infraError } from "./transcode-errors"

/**
 * ffprobe's word on an output of ours (adr/0069 §4 step 7), before it is
 * stored public: one video stream in the codec we chose, no sound, at most
 * 30 s, the short edge at most 720 px with even sides, and no tag beyond
 * the container's own bookkeeping. A place, a device, a date or a name
 * the upload carried fails it. A failure is ours (a pipeline that let
 * something through), so it is an infrastructure error: tried again, then
 * `video.processing_failed`.
 */

const CODEC: Readonly<Record<OutputKind, string>> = { mp4: "h264", webm: "vp9" }

/**
 * The tags MP4 and WebM muxers write of themselves even under `bitexact`
 * (the brand, the track's handler and language, an encoder name without
 * its version, WebM's per-track length). Anything else is refused.
 */
export const STRUCTURAL_TAGS: ReadonlySet<string> = new Set([
  "major_brand",
  "minor_version",
  "compatible_brands",
  "handler_name",
  "vendor_id",
  "language",
  "encoder",
  "ENCODER",
  "DURATION",
])

const tags = z.record(z.string().max(64), z.string().max(256)).optional()

const outputSchema = z.object({
  streams: z
    .array(
      z.object({
        index: z.number().int().min(0),
        codec_type: z.string().max(32).optional(),
        codec_name: z.string().max(64).optional(),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        duration: z.string().max(32).optional(),
        tags,
      })
    )
    .max(8),
  format: z.object({
    format_name: z.string().max(128).optional(),
    duration: z.string().max(32).optional(),
    tags,
  }),
})

export interface OutputVerdict {
  width: number
  height: number
  durationMs: number
}

const refuse = (kind: OutputKind, rule: string) =>
  infraError(`video output ${kind} failed its check: ${rule}`)

/** The tags beyond the structural ones, by name only (their values are never logged). */
export function strayTags(found: Record<string, string> | undefined): string[] {
  return Object.keys(found ?? {}).filter((key) => !STRUCTURAL_TAGS.has(key))
}

export function assessOutput(raw: unknown, kind: OutputKind): OutputVerdict {
  const parsed = outputSchema.safeParse(raw)
  if (!parsed.success) {
    throw refuse(kind, "unreadable")
  }
  const { streams, format } = parsed.data
  if (format.format_name?.split(",", 1)[0] !== OUTPUT_DEMUXER[kind]) {
    throw refuse(kind, "container")
  }
  const [stream, ...others] = streams
  if (!stream || others.length > 0 || stream.codec_type !== "video") {
    throw refuse(kind, "streams")
  }
  if (stream.codec_name !== CODEC[kind]) {
    throw refuse(kind, "codec")
  }
  const { width = 0, height = 0 } = stream
  if (
    width <= 0 ||
    height <= 0 ||
    width % 2 !== 0 ||
    height % 2 !== 0 ||
    Math.min(width, height) > OUTPUT_SHORT_EDGE
  ) {
    throw refuse(kind, "size")
  }
  const durations = [format.duration, stream.duration]
    .map(decimalOf)
    .filter((value): value is number => value !== null)
  if (durations.length === 0) {
    throw refuse(kind, "duration")
  }
  const durationMs = Math.round(Math.max(...durations) * 1000)
  if (durationMs > OUTPUT_MAX_DURATION_MS) {
    throw refuse(kind, "duration")
  }
  const stray = [...strayTags(format.tags), ...strayTags(stream.tags)]
  if (stray.length > 0) {
    throw refuse(kind, `tags ${stray.join(",").slice(0, 200)}`)
  }
  return { width, height, durationMs }
}
