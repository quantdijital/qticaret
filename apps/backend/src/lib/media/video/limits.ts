/**
 * The limits a product video is held to (adr/0069 §3). The upload gate,
 * the receiver, the probe's verdict and the workflow read them from here.
 */

const MB = 1024 * 1024

/** The largest clip a shop may upload: its bytes, counted as they arrive. */
export const VIDEO_MAX_BYTES = 50 * MB

/** The declared size the video path's gate lets through: the clip and its multipart framing. */
export const VIDEO_MAX_REQUEST_BYTES = 52 * MB

/** Videos on one product at most, uploads and YouTube links together (Kararlar 2). */
export const VIDEOS_PER_PRODUCT = 2

/** Longest clip in milliseconds: 30 s and a half second of slack (the container's or a stream's). */
export const VIDEO_MAX_DURATION_MS = 30_500

/** A side's pixels at most, and the frame's: 4096 × 2304, a little above 4K. */
export const VIDEO_MAX_SIDE = 4096
export const VIDEO_MAX_PIXELS = 4096 * 2304

/** Frames per second at most, and the frames a clip may declare (30.5 s at that rate). */
export const VIDEO_MAX_FPS = 120
export const VIDEO_MAX_FRAMES = Math.floor((VIDEO_MAX_DURATION_MS / 1000) * VIDEO_MAX_FPS)

/** Streams in one file at most (video, audio, data, subtitles together). */
export const VIDEO_MAX_STREAMS = 16

/** Codecs a clip's video may be in (iPhone HEVC/MOV included); GIF waits for slice 7. */
export const VIDEO_CODECS: ReadonlySet<string> = new Set([
  "h264",
  "hevc",
  "vp8",
  "vp9",
  "av1",
  "mpeg4",
])

/** Codecs a cover picture beside the video (`attached_pic`) may be in: MP4/MOV cover art. */
export const COVER_CODECS: ReadonlySet<string> = new Set(["mjpeg", "png"])

/**
 * The decoders ffprobe may open while it reads a clip (`-codec_whitelist`,
 * security review O1): the video codecs above by their decoders' names
 * (AV1 is read by dav1d where it is installed) and the sound phones and
 * browsers record. Any other stream is still listed by its codec's name,
 * from the container, and refused by the rules; only its decoder is never
 * opened.
 */
export const PROBE_DECODERS = [
  "h264",
  "hevc",
  "vp8",
  "vp9",
  "av1",
  "libdav1d",
  "mpeg4",
  // A cover picture's (the codecs it may be in, above)
  "mjpeg",
  "png",
  // Sound: phones (AAC), browsers (Opus, Vorbis), cameras (PCM), MP3
  "aac",
  "opus",
  "vorbis",
  "mp3float",
  "pcm_s16le",
  "pcm_s16be",
  "pcm_s24le",
] as const

/** ffprobe's own bounds on what it reads and allocates (security review O1). */
export const PROBE_BOUNDS = {
  // ffmpeg's defaults, written out: enough for a phone's HEVC MOV, whose sizes are in its header
  probesize: 5_000_000,
  analyzeduration: 5_000_000,
  // One allocation at most: a 4K frame is ~30 MB, a 50 MB clip's largest sample is less
  maxAlloc: 256 * 1024 * 1024,
} as const

/** How long one ffprobe run may take before it is killed and the clip refused. */
export const PROBE_TIMEOUT_MS = 15_000

/** ffprobe's answer at most (JSON for at most 16 streams is a few kilobytes). */
export const PROBE_MAX_OUTPUT_BYTES = 64 * 1024

/** ffprobe runs at once in this process, how many may wait, and for how long. */
export const PROBE_CONCURRENCY = 2
export const PROBE_MAX_WAITING = 8
export const PROBE_WAIT_TIMEOUT_MS = 15_000

/** Video uploads this process receives at once; one more is told to come back. */
export const UPLOAD_CONCURRENCY = 3

/** The bytes read from a file's start to tell what it is. */
export const SIGNATURE_BYTES = 512

/** A clip's title at most (characters). */
export const VIDEO_TITLE_MAX = 200

/**
 * The transcoding job (adr/0069 §4): what it makes and the bounds it runs
 * in. The outputs' short edge, frame rate and length; the threads each
 * encoder takes (half of the VPS's four cores); one pass's time and the
 * whole job's before SIGKILL; the free disk it needs to start.
 */
export const OUTPUT_SHORT_EDGE = 720
export const OUTPUT_MAX_FPS = 30
export const OUTPUT_SECONDS = 30
// An output may end one frame past 30 s (a frame's length, rounded up): more is refused
export const OUTPUT_MAX_DURATION_MS = 30_100
export const ENCODE_THREADS = 2
export const PASS_TIMEOUT_MS = 4 * 60 * 1000
export const JOB_TIMEOUT_MS = 10 * 60 * 1000
export const MIN_FREE_DISK_BYTES = 500 * MB
/** The lowest priority a process can be given: the shop's requests come first. */
export const ENCODE_PRIORITY = 19

/** The job's sign of life, how long a silent one is waited for, and its tries at most. */
export const HEARTBEAT_MS = 30 * 1000
export const STALE_AFTER_MS = 10 * 60 * 1000
export const MAX_ATTEMPTS = 3

/** A failed clip's source is kept this long for "Yeniden dene" (adr/0069 §1), then swept. */
export const FAILED_SOURCE_KEPT_MS = 7 * 24 * 60 * 60 * 1000
/**
 * A retry is taken until an hour before the sweep may remove the source:
 * the sweep and the retry never meet on one clip, whatever their clocks.
 */
export const RETRY_MARGIN_MS = 60 * 60 * 1000

/**
 * A ready clip's source the job left (storage refused it) is swept once the
 * clip has been ready this long: a clip just made is the job's own to tidy.
 */
export const READY_SOURCE_GRACE_MS = 60 * 60 * 1000

/** The oldest failure (`failed_at`) a clip may have and still be retried. */
export const retryKeptSince = (now: number): Date =>
  new Date(now - (FAILED_SOURCE_KEPT_MS - RETRY_MARGIN_MS))

/** A poster's first frame darker than this (mean of 0–255) gives way to the frame at 1 s. */
export const DARK_FRAME_MEAN = 12
