import {
  COMMON_OUTPUT_ARGS,
  encodeArgs,
  inputBounds,
  outputProbeArgs,
  posterArgs,
  scaleFilter,
  scaledSize,
} from ".."

/** adr/0069 §4: the exact arguments the transcoding job gives ffmpeg. */

const BOUNDS_MOV = [
  "-max_alloc",
  "268435456",
  "-protocol_whitelist",
  "file",
  "-format_whitelist",
  "mov",
  "-codec_whitelist",
  "h264,hevc,vp8,vp9,av1,libdav1d,mpeg4,mjpeg,png,aac,opus,vorbis,mp3float,pcm_s16le,pcm_s16be,pcm_s24le",
  "-max_streams",
  "16",
  "-max_pixels",
  "9437184",
  "-threads",
  "1",
  "-probesize",
  "5000000",
  "-analyzeduration",
  "5000000",
  "-enable_drefs",
  "0",
  "-use_absolute_path",
  "0",
  "-f",
  "mov",
]

const SCALE =
  "scale=w='if(lte(iw,ih),trunc(min(720,iw)/2)*2,-2)':h='if(lte(iw,ih),-2,trunc(min(720,ih)/2)*2)'"

const COMMON = [
  "-map",
  "0:V:0",
  "-vf",
  SCALE,
  "-fpsmax",
  "30",
  "-t",
  "30",
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
  "2",
]

// ffmpeg's own CPU limit (review S5): two threads × the 4-minute pass
const HEAD = ["-hide_banner", "-loglevel", "error", "-nostdin", "-timelimit", "480", "-y"]

describe("the transcoding arguments", () => {
  it("reads the input with the upload's bounds", () => {
    expect(inputBounds("mov")).toEqual(BOUNDS_MOV)
  })

  it("makes the MP4 with exactly the ADR's arguments", () => {
    expect(
      encodeArgs("mp4", "mov", "/tmp/qt-video-x/source", "/tmp/qt-video-x/output.mp4")
    ).toEqual([
      ...HEAD,
      ...BOUNDS_MOV,
      "-i",
      "file:/tmp/qt-video-x/source",
      ...COMMON,
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
      "-a53cc",
      "0",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-f",
      "mp4",
      "file:/tmp/qt-video-x/output.mp4",
    ])
  })

  it("makes the WebM with exactly the ADR's arguments, a WebM source read as Matroska", () => {
    const args = encodeArgs("webm", "matroska", "/tmp/d/source", "/tmp/d/output.webm")
    const at = args.indexOf("-i")
    expect(args.slice(HEAD.length, at)).toEqual(inputBounds("matroska"))
    expect(args.slice(at, at + 2)).toEqual(["-i", "file:/tmp/d/source"])
    expect(args.slice(at + 2)).toEqual([
      ...COMMON,
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
      "file:/tmp/d/output.webm",
    ])
  })

  it("takes only the first moving picture (capital V) and drops sound, data and every tag", () => {
    expect(COMMON_OUTPUT_ARGS).toEqual(COMMON)
    const args = encodeArgs("mp4", "mov", "/a/source", "/a/out.mp4")
    expect(args).not.toContain("0:v:0")
    // Input bounds before -i, outputs after: the protocol whitelist reaches the input
    expect(args.indexOf("-protocol_whitelist")).toBeLessThan(args.indexOf("-i"))
    expect(args.indexOf("-map")).toBeGreaterThan(args.indexOf("-i"))
  })

  it("refuses a path that is not absolute or holds a line break", () => {
    expect(() => encodeArgs("mp4", "mov", "source", "/a/out.mp4")).toThrow()
    expect(() => encodeArgs("mp4", "mov", "/a/source", "/a/out\n.mp4")).toThrow()
    expect(() => encodeArgs("mp4", "mov", "concat:/etc/passwd", "/a/out.mp4")).toThrow()
  })

  it("takes the poster's frame from our own MP4, at 1 s when asked", () => {
    expect(posterArgs("/a/output.mp4", "/a/poster.png")).toEqual([
      ...HEAD,
      ...BOUNDS_MOV,
      "-i",
      "file:/a/output.mp4",
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
      "2",
      "-c:v",
      "png",
      "-f",
      "image2",
      "-update",
      "1",
      "file:/a/poster.png",
    ])
    expect(posterArgs("/a/output.mp4", "/a/p.png", 1).slice(HEAD.length, HEAD.length + 2)).toEqual([
      "-ss",
      "1",
    ])
  })

  it("reads an output back with its tags and bounds", () => {
    const args = outputProbeArgs("webm", "/a/output.webm")
    expect(args).toContain("matroska")
    expect(args[args.indexOf("-show_entries") + 1]).toContain("stream_tags")
    expect(args[args.indexOf("-show_entries") + 1]).toContain("closed_captions")
    expect(args[args.indexOf("-show_entries") + 1]).toContain("format_tags")
    expect(args.slice(-2)).toEqual(["-i", "file:/a/output.webm"])
  })
})

describe("the 720 px rule", () => {
  it("is the filter ffmpeg applies after turning the picture upright", () => {
    expect(scaleFilter()).toBe(SCALE)
  })

  it.each([
    [1920, 1080, 1280, 720],
    [1080, 1920, 720, 1280],
    [3840, 2160, 1280, 720],
    [1280, 720, 1280, 720],
    [720, 720, 720, 720],
    [1000, 1000, 720, 720],
    // Never enlarged; odd sides made even
    [320, 240, 320, 240],
    [321, 241, 320, 240],
    [641, 359, 640, 358],
    // Wide and tall extremes keep their ratio
    [4096, 1024, 2880, 720],
    [1024, 4096, 720, 2880],
    [2, 2, 2, 2],
  ])("%i × %i → %i × %i", (width, height, outWidth, outHeight) => {
    expect(scaledSize(width, height)).toEqual({ width: outWidth, height: outHeight })
  })
})
