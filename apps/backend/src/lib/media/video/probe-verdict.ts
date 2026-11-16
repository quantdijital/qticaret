import { z } from "@medusajs/framework/zod"
import { ValidationError } from "../../errors"
import {
  VIDEO_CODECS,
  VIDEO_MAX_DURATION_MS,
  VIDEO_MAX_FPS,
  VIDEO_MAX_FRAMES,
  VIDEO_MAX_PIXELS,
  VIDEO_MAX_SIDE,
  VIDEO_MAX_STREAMS,
} from "./limits"
import type { VideoDemuxer } from "./signature"

/**
 * ffprobe's JSON about an uploaded clip, checked against its schema and
 * then against adr/0069 §3's limits. The answer comes from a program that
 * read untrusted bytes: every field is bounded, numbers in text are read by
 * hand (no regular expression), and anything unexpected refuses the clip.
 */

// ffprobe writes durations and rates as text ("12.345000", "30000/1001")
const numberText = z.string().max(32)

const streamSchema = z.object({
  index: z.number().int().min(0).max(10_000),
  codec_type: z.string().max(32).optional(),
  codec_name: z.string().max(64).optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  avg_frame_rate: numberText.optional(),
  r_frame_rate: numberText.optional(),
  nb_frames: numberText.optional(),
  duration: numberText.optional(),
  disposition: z.object({ attached_pic: z.number().int().optional() }).optional(),
})

export const probeOutputSchema = z.object({
  // A few more than the rule allows, so an excess is refused by the rule, not the schema
  streams: z.array(streamSchema).max(VIDEO_MAX_STREAMS * 4),
  format: z
    .object({
      format_name: z.string().max(128).optional(),
      duration: numberText.optional(),
      nb_streams: z.number().int().min(0).optional(),
    })
    .optional(),
})

export type ProbeOutput = z.infer<typeof probeOutputSchema>
type ProbeStream = ProbeOutput["streams"][number]

export interface ProbeVerdict {
  width: number
  height: number
  durationMs: number
}

const refuse = (code: string): ValidationError => new ValidationError(code, { field: "file" })

/** A non-negative decimal written as digits and at most one dot, or null. */
export function decimalOf(text: string | undefined): number | null {
  if (text === undefined || text.length === 0 || text.length > 32) {
    return null
  }
  let dot = false
  let digits = 0
  for (const char of text) {
    if (char === ".") {
      if (dot) {
        return null
      }
      dot = true
    } else if (char >= "0" && char <= "9") {
      digits += 1
    } else {
      return null
    }
  }
  const value = Number(text)
  return digits > 0 && Number.isFinite(value) ? value : null
}

/** A rate written `num/den` (or a plain number), or null for `0/0` and anything else. */
export function rateOf(text: string | undefined): number | null {
  if (text === undefined) {
    return null
  }
  const slash = text.indexOf("/")
  if (slash < 0) {
    const value = decimalOf(text)
    return value !== null && value > 0 ? value : null
  }
  const numerator = decimalOf(text.slice(0, slash))
  const denominator = decimalOf(text.slice(slash + 1))
  if (numerator === null || denominator === null || denominator === 0 || numerator === 0) {
    return null
  }
  return numerator / denominator
}

const sizeOk = (stream: ProbeStream): boolean => {
  const { width, height } = stream
  return (
    width !== undefined &&
    height !== undefined &&
    width > 0 &&
    height > 0 &&
    width <= VIDEO_MAX_SIDE &&
    height <= VIDEO_MAX_SIDE &&
    width * height <= VIDEO_MAX_PIXELS
  )
}

function checkPicture(stream: ProbeStream): void {
  if (stream.width === undefined || stream.height === undefined) {
    throw refuse("video.unreadable")
  }
  if (!sizeOk(stream)) {
    throw refuse("video.dimensions_too_large")
  }
}

function checkVideoStream(stream: ProbeStream): void {
  checkPicture(stream)
  if (stream.codec_name === undefined || !VIDEO_CODECS.has(stream.codec_name)) {
    throw refuse("video.unsupported_type")
  }
  const fps = rateOf(stream.avg_frame_rate) ?? rateOf(stream.r_frame_rate)
  if (fps !== null && fps > VIDEO_MAX_FPS) {
    throw refuse("video.frame_rate_too_high")
  }
  const frames = decimalOf(stream.nb_frames)
  if (frames !== null && frames > VIDEO_MAX_FRAMES) {
    throw refuse("video.too_long")
  }
}

/**
 * The clip's size and length when ffprobe's answer passes every rule:
 * the demuxer it was forced to, at most 16 streams, at least one video
 * stream (a cover picture does not count), every video stream in an
 * allowed codec, at most 4096 px a side and 4096 × 2304 in all, at most
 * 120 fps and 3660 frames, and 30.5 s at most by the longest of the
 * container's and the video streams' durations (an unknown length is
 * refused). Throws `ValidationError` (`video.*`, field `file`) otherwise.
 */
export function assessProbe(raw: unknown, demuxer: VideoDemuxer): ProbeVerdict {
  const parsed = probeOutputSchema.safeParse(raw)
  if (!parsed.success) {
    throw refuse("video.unreadable")
  }
  const { streams, format } = parsed.data
  const family = format?.format_name?.split(",", 1)[0]
  if (family !== demuxer) {
    throw refuse("video.unreadable")
  }
  const count = Math.max(streams.length, format?.nb_streams ?? 0)
  if (count === 0 || count > VIDEO_MAX_STREAMS) {
    throw refuse("video.unreadable")
  }
  const videos = streams.filter((stream) => stream.codec_type === "video")
  const pictures = videos.filter((stream) => stream.disposition?.attached_pic === 1)
  const moving = videos.filter((stream) => stream.disposition?.attached_pic !== 1)
  const [first] = moving
  if (!first) {
    throw refuse("video.unsupported_type")
  }
  pictures.forEach(checkPicture)
  moving.forEach(checkVideoStream)
  const durations = [format?.duration, ...moving.map((stream) => stream.duration)]
    .map(decimalOf)
    .filter((value): value is number => value !== null)
  if (durations.length === 0) {
    throw refuse("video.unreadable")
  }
  const durationMs = Math.round(Math.max(...durations) * 1000)
  if (durationMs > VIDEO_MAX_DURATION_MS) {
    throw refuse("video.too_long")
  }
  return { width: first.width ?? 0, height: first.height ?? 0, durationMs }
}
