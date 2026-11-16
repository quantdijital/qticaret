import { isAbsolute } from "node:path"
import { PROBE_BOUNDS, PROBE_DECODERS, VIDEO_MAX_PIXELS, VIDEO_MAX_STREAMS } from "./limits"
import type { VideoDemuxer } from "./signature"

/**
 * ffprobe's argument list for an uploaded clip (adr/0069 §3, security
 * review O1). The demuxer is forced from the signature (`-f mov|matroska`)
 * and is the only one allowed (`-format_whitelist`): ffprobe never guesses
 * the format from content, so the HLS, concat and other demuxers that open
 * further files are never chosen. Only the `file` protocol is allowed and
 * the input is our own path with its `file:` prefix: a nested `concat:`,
 * `subfile:`, `data:`, `http:` or `hls:` path inside the clip cannot be
 * opened. A MOV's external data references stay off by name.
 *
 * Bounds before anything is decided: at most 16 streams, only the decoders
 * of the codecs taken (others are never opened), at most 4096 × 2304 pixels
 * a frame in a decoder, one thread, ffmpeg's default probe size and
 * duration written out, and a ceiling on any single allocation. The same
 * options go into slice 2's ffmpeg run (adr/0069 §4 note).
 */

// Only what the verdict reads: no tags (they hold places, devices, names)
const SHOW_ENTRIES = [
  "stream=index,codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,nb_frames,duration",
  "stream_disposition=attached_pic",
  "format=format_name,duration,nb_streams",
].join(":")

// A MOV may point at other files (data references); both are off by default, and stay off
const DEMUXER_OPTIONS: Readonly<Record<VideoDemuxer, readonly string[]>> = {
  mov: ["-enable_drefs", "0", "-use_absolute_path", "0"],
  matroska: [],
  gif: [],
}

/** The input bounds both programs take before `-i` (slice 2 reuses them for ffmpeg). */
export function inputBounds(demuxer: VideoDemuxer): string[] {
  return [
    "-max_alloc",
    String(PROBE_BOUNDS.maxAlloc),
    "-protocol_whitelist",
    "file",
    "-format_whitelist",
    demuxer,
    "-codec_whitelist",
    PROBE_DECODERS.join(","),
    "-max_streams",
    String(VIDEO_MAX_STREAMS),
    "-max_pixels",
    String(VIDEO_MAX_PIXELS),
    "-threads",
    "1",
    "-probesize",
    String(PROBE_BOUNDS.probesize),
    "-analyzeduration",
    String(PROBE_BOUNDS.analyzeduration),
    ...DEMUXER_OPTIONS[demuxer],
    "-f",
    demuxer,
  ]
}

/** ffprobe's whole argument list for a clip at `path` read with `demuxer`. */
export function probeArgs(demuxer: VideoDemuxer, path: string): string[] {
  if (!isAbsolute(path) || path.includes("\n") || path.includes("\0")) {
    throw new Error("video probe: the path must be one of ours, absolute")
  }
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    ...inputBounds(demuxer),
    "-show_entries",
    SHOW_ENTRIES,
    "-of",
    "json",
    "-i",
    `file:${path}`,
  ]
}
