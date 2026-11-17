import { RetryableError, ValidationError } from "../../../errors"
import {
  PROCESSING_FAILED,
  ProbeStoppedError,
  VideoJobError,
  afterFailure,
  assessOutput,
  classifyFailure,
  createSlots,
  infraError,
  inputError,
  probeVideo,
} from ".."
import { ToolStartError } from "../run-tool"
import { fakeSpawn } from "./fake-spawn"

/** adr/0069 §4: an output's check, and the two classes of failure. */

const mp4 = (overrides: { stream?: object; format?: object; extra?: object[] } = {}) => ({
  streams: [
    {
      index: 0,
      codec_type: "video",
      codec_name: "h264",
      width: 1280,
      height: 720,
      duration: "30.000000",
      tags: { language: "und", handler_name: "VideoHandler", encoder: "Lavc libx264" },
      ...overrides.stream,
    },
    ...(overrides.extra ?? []),
  ],
  format: {
    format_name: "mov,mp4,m4a,3gp,3g2,mj2",
    duration: "30.000000",
    tags: { major_brand: "isom", minor_version: "512", compatible_brands: "isomiso2avc1mp41" },
    ...overrides.format,
  },
})

const refused = (raw: unknown, kind: "mp4" | "webm" = "mp4") => {
  try {
    assessOutput(raw, kind)
  } catch (error) {
    return classifyFailure(error)
  }
  return null
}

describe("an output's check", () => {
  it("passes a clean MP4 and WebM", () => {
    expect(assessOutput(mp4(), "mp4")).toEqual({ width: 1280, height: 720, durationMs: 30_000 })
    expect(
      assessOutput(
        {
          streams: [
            {
              index: 0,
              codec_type: "video",
              codec_name: "vp9",
              width: 720,
              height: 1280,
              tags: { ENCODER: "Lavc libvpx-vp9", DURATION: "00:00:12.000000000" },
            },
          ],
          format: {
            format_name: "matroska,webm",
            duration: "12.000000",
            tags: { encoder: "Lavf" },
          },
        },
        "webm"
      )
    ).toEqual({ width: 720, height: 1280, durationMs: 12_000 })
  })

  it.each([
    ["a place tag", mp4({ format: { tags: { location: "+41.0082+028.9784/" } } })],
    [
      "Apple's place tag",
      mp4({ format: { tags: { "com.apple.quicktime.location.ISO6709": "+41+028/" } } }),
    ],
    ["a date on the stream", mp4({ stream: { tags: { creation_time: "2026-11-01" } } })],
    ["a sound stream", mp4({ extra: [{ index: 1, codec_type: "audio", codec_name: "aac" }] })],
    // Review S6: captions carried inside the H.264 stream
    ["closed captions", mp4({ stream: { closed_captions: 1 } })],
    // Review INFO: a structural tag with a value its muxer does not write
    ["a handler named by the source", mp4({ stream: { tags: { handler_name: "iPhone 15" } } })],
    ["an encoder that is not libav", mp4({ stream: { tags: { encoder: "Apple ProRes" } } })],
    ["a language that is not a code", mp4({ stream: { tags: { language: "Istanbul" } } })],
    ["a brand that is not one", mp4({ format: { tags: { major_brand: "+41.0082" } } })],
    ["31 seconds", mp4({ format: { duration: "31.000000" } })],
    ["an odd side", mp4({ stream: { width: 1279 } })],
    ["a short edge past 720", mp4({ stream: { width: 1920, height: 1080 } })],
    ["another codec", mp4({ stream: { codec_name: "hevc" } })],
    ["another container", mp4({ format: { format_name: "matroska,webm" } })],
    ["no length", mp4({ stream: { duration: undefined }, format: { duration: "N/A" } })],
    ["not ffprobe's JSON", { streams: "x" }],
  ])("refuses %s as the pipeline's own failure (tried again)", (_, raw) => {
    expect(refused(raw)).toEqual({ kind: "infra", code: PROCESSING_FAILED })
  })

  it("names a stray tag in its error, never its value", () => {
    try {
      assessOutput(mp4({ format: { tags: { location: "+41.0082+028.9784/" } } }), "mp4")
    } catch (error) {
      expect((error as Error).message).toContain("location")
      expect((error as Error).message).not.toContain("41.0082")
    }
  })
})

describe("the failure classes", () => {
  it("fails the clip's own faults at once, with their own key", () => {
    expect(classifyFailure(new ValidationError("video.unreadable", { field: "file" }))).toEqual({
      kind: "input",
      code: "video.unreadable",
    })
    expect(classifyFailure(inputError("video.too_large"))).toEqual({
      kind: "input",
      code: "video.too_large",
    })
  })

  it("tries the machine's faults again", () => {
    for (const error of [
      infraError("ffmpeg mp4: exit 1 null"),
      new ToolStartError("ENOENT"),
      new RetryableError("video.upload_busy"),
      new ValidationError("products.unknown"),
      new Error("ECONNRESET"),
      "something thrown",
    ]) {
      expect(classifyFailure(error)).toEqual({ kind: "infra", code: PROCESSING_FAILED })
    }
    expect(infraError("x")).toBeInstanceOf(VideoJobError)
  })

  it("tries again a re-probe stopped by its time; fails one ffprobe refused (review S7)", async () => {
    const slots = () =>
      createSlots({ concurrency: 2, maxWaiting: 1, waitTimeoutMs: 1000, busy: () => new Error() })
    const env = { FFPROBE_PATH: "ffprobe" }
    const hung = fakeSpawn(() => ({ hang: true }))
    const stopped = await probeVideo("/tmp/qt-video-x/source", "mov", {
      spawn: hung.spawn,
      slots: slots(),
      env,
      timeoutMs: 30,
    }).catch((error: unknown) => error)
    expect(stopped).toBeInstanceOf(ProbeStoppedError)
    // To an upload it is the same refusal as before
    expect((stopped as ValidationError).safeMessage).toBe("video.unreadable")
    expect(classifyFailure(stopped)).toEqual({ kind: "infra", code: PROCESSING_FAILED })

    const refusing = fakeSpawn(() => ({ code: 1 }))
    const refused = await probeVideo("/tmp/qt-video-x/source", "mov", {
      spawn: refusing.spawn,
      slots: slots(),
      env,
    }).catch((error: unknown) => error)
    expect(refused).not.toBeInstanceOf(ProbeStoppedError)
    expect(classifyFailure(refused)).toEqual({ kind: "input", code: "video.unreadable" })
  })

  it("fails an input error on its first try", () => {
    expect(afterFailure(0, { kind: "input", code: "video.unreadable" })).toEqual({
      status: "failed",
      attempts: 1,
      error_code: "video.unreadable",
    })
  })

  it("puts an infrastructure error back twice, then fails it on the third try", () => {
    const infra = { kind: "infra" as const, code: PROCESSING_FAILED }
    expect(afterFailure(0, infra)).toEqual({ status: "uploaded", attempts: 1, error_code: null })
    expect(afterFailure(1, infra)).toEqual({ status: "uploaded", attempts: 2, error_code: null })
    expect(afterFailure(2, infra)).toEqual({
      status: "failed",
      attempts: 3,
      error_code: PROCESSING_FAILED,
    })
  })
})
