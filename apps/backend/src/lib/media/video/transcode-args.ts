import { isAbsolute } from "node:path"
import {
  ENCODE_THREADS,
  OUTPUT_MAX_FPS,
  OUTPUT_SECONDS,
  OUTPUT_SHORT_EDGE,
  PASS_TIMEOUT_MS,
} from "./limits"
import { inputBounds } from "./probe-args"
import type { VideoDemuxer } from "./signature"

/**
 * ffmpeg's argument lists for the transcoding job (adr/0069 §4): argument
 * arrays, never a shell. Every run reads its input with the same bounds as
 * the upload's ffprobe (`inputBounds`: the forced demuxer alone, the
 * `file` protocol alone, the decoders allowed, the pixels and streams at
 * most) and takes only the first moving picture (`-map 0:V:0`; capital V
 * leaves out a cover picture). Sound, subtitles, data streams, chapters
 * and every tag are dropped (`-map_metadata -1`, `-fflags +bitexact`): a
 * phone's place, device and date never reach an output.
 */

export type OutputKind = "mp4" | "webm"

/** The demuxer an output of ours is read back with (to verify it, to take its poster). */
export const OUTPUT_DEMUXER: Readonly<Record<OutputKind, VideoDemuxer>> = {
  mp4: "mov",
  webm: "matroska",
}

/** A path of ours as ffmpeg's input or output: absolute, one line, behind `file:`. */
export function filePath(path: string): string {
  if (!isAbsolute(path) || path.includes("\n") || path.includes("\0")) {
    throw new Error("video transcode: the path must be one of ours, absolute")
  }
  return `file:${path}`
}

// The chosen short edge: down to even. The other side by the ratio, to the nearest even (ffmpeg's `-2`)
const even = (value: number): number => Math.max(2, Math.floor(value / 2) * 2)
const nearestEven = (value: number): number => Math.max(2, Math.round(value / 2) * 2)

/**
 * An output's size for a picture `width` × `height` as shown (after its
 * rotation): the short edge at most 720 px and never enlarged, the long one
 * by the same ratio, both even (H.264 and VP9 in 4:2:0 need it). The same
 * rule as `scaleFilter`, which ffmpeg applies itself after it turns the
 * picture upright; this one is for tests and records.
 */
export function scaledSize(width: number, height: number): { width: number; height: number } {
  if (width <= height) {
    const w = even(Math.min(OUTPUT_SHORT_EDGE, width))
    return { width: w, height: nearestEven((height * w) / width) }
  }
  const h = even(Math.min(OUTPUT_SHORT_EDGE, height))
  return { width: nearestEven((width * h) / height), height: h }
}

/**
 * The scale filter: ffmpeg works on the upright picture (its own rotation
 * from the clip's display matrix), so the short edge is chosen there; `-2`
 * keeps the ratio with an even side.
 */
export function scaleFilter(shortEdge: number = OUTPUT_SHORT_EDGE): string {
  // Quoted for the filter graph's parser (its commas are the expression's); no shell sees it
  const edge = (side: "iw" | "ih") => `trunc(min(${String(shortEdge)},${side})/2)*2`
  return `scale=w='if(lte(iw,ih),${edge("iw")},-2)':h='if(lte(iw,ih),-2,${edge("ih")})'`
}

/**
 * ffmpeg's own stop (security review S5), a backstop behind our SIGKILL:
 * user CPU seconds of the whole process, every thread counted (the
 * decoder, x264's lookahead, the filters, as well as the two encoder
 * threads). Sized as two threads busy for the 4-minute pass, so it lines
 * up with the wall clock limit only roughly: a pass using more threads
 * reaches it sooner. Our kill stays the first line.
 */
export const FFMPEG_CPU_LIMIT_S = (ENCODE_THREADS * PASS_TIMEOUT_MS) / 1000

const HEAD = [
  "-hide_banner",
  "-loglevel",
  "error",
  "-nostdin",
  "-timelimit",
  String(FFMPEG_CPU_LIMIT_S),
  "-y",
]

/** What every output shares (adr/0069 §4 step 5). */
export const COMMON_OUTPUT_ARGS: readonly string[] = [
  "-map",
  "0:V:0",
  "-vf",
  scaleFilter(),
  "-fpsmax",
  String(OUTPUT_MAX_FPS),
  "-t",
  String(OUTPUT_SECONDS),
  "-an",
  "-sn",
  "-dn",
  "-map_chapters",
  "-1",
  "-map_metadata",
  "-1",
  "-fflags",
  "+bitexact",
  "-threads",
  String(ENCODE_THREADS),
]

/** H.264 in MP4, every browser's (adr/0069 §4 step 3). */
export const MP4_ENCODER_ARGS: readonly string[] = [
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "24",
  "-maxrate",
  "2M",
  "-bufsize",
  "4M",
  "-profile:v",
  "high",
  // No closed captions carried over from the source into the H.264 stream (review S6)
  "-a53cc",
  "0",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-f",
  "mp4",
]

/**
 * VP9 in WebM (adr/0069 §4 step 4). `-pix_fmt yuv420p` as for the MP4: a
 * 10-bit phone clip would otherwise come out in a profile some browsers
 * do not play.
 */
export const WEBM_ENCODER_ARGS: readonly string[] = [
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "33",
  "-b:v",
  "2M",
  "-row-mt",
  "1",
  "-deadline",
  "good",
  "-cpu-used",
  "4",
  "-pix_fmt",
  "yuv420p",
  "-f",
  "webm",
]

const ENCODER_ARGS: Readonly<Record<OutputKind, readonly string[]>> = {
  mp4: MP4_ENCODER_ARGS,
  webm: WEBM_ENCODER_ARGS,
}

/** ffmpeg's whole argument list to make `kind` at `output` from the clip at `input`. */
export function encodeArgs(
  kind: OutputKind,
  demuxer: VideoDemuxer,
  input: string,
  output: string
): string[] {
  return [
    ...HEAD,
    ...inputBounds(demuxer),
    "-i",
    filePath(input),
    ...COMMON_OUTPUT_ARGS,
    ...ENCODER_ARGS[kind],
    filePath(output),
  ]
}

/**
 * One frame of our own MP4 as a PNG, for the poster (adr/0069 §4 step 6):
 * the first, or the one at `atSeconds`. Read from the output, not the
 * upload: what is decoded here is already ours.
 */
export function posterArgs(input: string, output: string, atSeconds = 0): string[] {
  return [
    ...HEAD,
    ...(atSeconds > 0 ? ["-ss", String(atSeconds)] : []),
    ...inputBounds(OUTPUT_DEMUXER.mp4),
    "-i",
    filePath(input),
    "-map",
    "0:V:0",
    "-frames:v",
    "1",
    "-an",
    "-sn",
    "-dn",
    "-map_metadata",
    "-1",
    "-fflags",
    "+bitexact",
    "-threads",
    String(ENCODE_THREADS),
    "-c:v",
    "png",
    "-f",
    "image2",
    "-update",
    "1",
    filePath(output),
  ]
}

// What the check of an output reads: its streams, length and every tag
const OUTPUT_ENTRIES = [
  "stream=index,codec_type,codec_name,width,height,duration,closed_captions",
  "stream_tags",
  "format=format_name,duration,nb_streams",
  "format_tags",
].join(":")

/** ffprobe's argument list to check an output of ours (adr/0069 §4 step 7). */
export function outputProbeArgs(kind: OutputKind, path: string): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    ...inputBounds(OUTPUT_DEMUXER[kind]),
    "-show_entries",
    OUTPUT_ENTRIES,
    "-of",
    "json",
    "-i",
    filePath(path),
  ]
}
