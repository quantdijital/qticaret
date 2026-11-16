import { VIDEO_MAX_FRAMES, VIDEO_MAX_STREAMS, assessProbe, decimalOf, rateOf } from ".."
import { MP4_WITH_COVER, PHONE_HEVC_MOV, VP9_WEBM, phoneWith } from "./probe-fixtures"

const codeOf = (run: () => unknown): string | null => {
  try {
    run()
    return null
  } catch (error) {
    return (error as { safeMessage?: string; field?: string }).safeMessage ?? "thrown"
  }
}

describe("ffprobe's answer against the limits (adr/0069 §3)", () => {
  it("takes a phone's HEVC MOV with sound and data streams", () => {
    expect(assessProbe(PHONE_HEVC_MOV, "mov")).toEqual({
      width: 1920,
      height: 1080,
      durationMs: 12_046,
    })
  })

  it("takes a WebM without a frame count, by the container's duration", () => {
    expect(assessProbe(VP9_WEBM, "matroska")).toEqual({
      width: 1280,
      height: 720,
      durationMs: 8008,
    })
  })

  it("takes cover art beside the video without counting it as one", () => {
    expect(assessProbe(MP4_WITH_COVER, "mov")).toMatchObject({ width: 1280, height: 720 })
  })

  it("refuses with the field named, so the panel can say which input", () => {
    try {
      assessProbe(phoneWith({ duration: "31.000000" }), "mov")
      throw new Error("not refused")
    } catch (error) {
      expect(error).toMatchObject({ safeMessage: "video.too_long", field: "file" })
    }
  })

  it.each([
    // Length: the longest of the container's and the video streams' durations
    ["a 31 s container", phoneWith({}, { duration: "31.000000" }), "video.too_long"],
    ["a 31 s video stream in a short container", phoneWith({ duration: "31.0" }), "video.too_long"],
    ["30.5 s and a bit", phoneWith({ duration: "30.501" }), "video.too_long"],
    [
      "a frame count bomb",
      phoneWith({ nb_frames: String(VIDEO_MAX_FRAMES + 1) }),
      "video.too_long",
    ],
    [
      "no duration at all",
      phoneWith({ duration: undefined }, { duration: undefined }),
      "video.unreadable",
    ],
    // Size
    ["8K", phoneWith({ width: 7680, height: 4320 }), "video.dimensions_too_large"],
    ["one side past 4096", phoneWith({ width: 4098, height: 16 }), "video.dimensions_too_large"],
    [
      "4096 × 4096 (past the pixels)",
      phoneWith({ width: 4096, height: 4096 }),
      "video.dimensions_too_large",
    ],
    ["no width", phoneWith({ width: undefined }), "video.unreadable"],
    ["a zero height", phoneWith({ height: 0 }), "video.dimensions_too_large"],
    // Rate
    [
      "240 fps slow motion",
      phoneWith({ avg_frame_rate: "240/1", r_frame_rate: "240/1" }),
      "video.frame_rate_too_high",
    ],
    [
      "an unknown average rate falls back to the real one",
      phoneWith({ avg_frame_rate: "0/0", r_frame_rate: "1000/1" }),
      "video.frame_rate_too_high",
    ],
    // Codecs and streams
    ["ProRes", phoneWith({ codec_name: "prores" }), "video.unsupported_type"],
    ["a GIF stream (slice 7)", phoneWith({ codec_name: "gif" }), "video.unsupported_type"],
    ["no codec name", phoneWith({ codec_name: undefined }), "video.unsupported_type"],
  ])("refuses %s", (_, output, code) => {
    expect(codeOf(() => assessProbe(output, "mov"))).toBe(code)
  })

  it("holds every video stream to the rules, not only the first", () => {
    const second = { ...PHONE_HEVC_MOV.streams[0], index: 4, width: 8192, height: 8192 }
    const output = { ...PHONE_HEVC_MOV, streams: [...PHONE_HEVC_MOV.streams, second] }
    expect(codeOf(() => assessProbe(output, "mov"))).toBe("video.dimensions_too_large")
    const prores = { ...PHONE_HEVC_MOV.streams[0], index: 4, codec_name: "prores" }
    expect(
      codeOf(() =>
        assessProbe({ ...PHONE_HEVC_MOV, streams: [...PHONE_HEVC_MOV.streams, prores] }, "mov")
      )
    ).toBe("video.unsupported_type")
    // A huge cover picture is refused too
    const cover = { ...MP4_WITH_COVER.streams[1], width: 20_000, height: 20_000 }
    expect(
      codeOf(() =>
        assessProbe({ ...MP4_WITH_COVER, streams: [MP4_WITH_COVER.streams[0], cover] }, "mov")
      )
    ).toBe("video.dimensions_too_large")
  })

  it("takes a cover picture in JPEG or PNG only (security review D1)", () => {
    const cover = (codec: string) => ({
      ...MP4_WITH_COVER,
      streams: [MP4_WITH_COVER.streams[0], { ...MP4_WITH_COVER.streams[1], codec_name: codec }],
    })
    expect(codeOf(() => assessProbe(cover("png"), "mov"))).toBeNull()
    expect(codeOf(() => assessProbe(cover("bmp"), "mov"))).toBe("video.unsupported_type")
    expect(codeOf(() => assessProbe(cover("prores"), "mov"))).toBe("video.unsupported_type")
  })

  it("holds the greater of the two frame rates, and refuses when neither reads (D2)", () => {
    const rates = (avg: string, real: string) =>
      phoneWith({ avg_frame_rate: avg, r_frame_rate: real })
    expect(codeOf(() => assessProbe(rates("30/1", "240/1"), "mov"))).toBe(
      "video.frame_rate_too_high"
    )
    expect(codeOf(() => assessProbe(rates("240/1", "30/1"), "mov"))).toBe(
      "video.frame_rate_too_high"
    )
    expect(codeOf(() => assessProbe(rates("0/0", "30/1"), "mov"))).toBeNull()
    expect(codeOf(() => assessProbe(rates("0/0", "0/0"), "mov"))).toBe("video.unreadable")
    expect(codeOf(() => assessProbe(rates("1/0", "0/0"), "mov"))).toBe("video.unreadable")
    expect(codeOf(() => assessProbe(rates("1/0", "abc"), "mov"))).toBe("video.unreadable")
  })

  it("refuses sound only, or only a cover picture", () => {
    const audio = { ...PHONE_HEVC_MOV, streams: PHONE_HEVC_MOV.streams.slice(1) }
    expect(codeOf(() => assessProbe(audio, "mov"))).toBe("video.unsupported_type")
    const coverOnly = { ...MP4_WITH_COVER, streams: MP4_WITH_COVER.streams.slice(1) }
    expect(codeOf(() => assessProbe(coverOnly, "mov"))).toBe("video.unsupported_type")
  })

  it("refuses more than 16 streams, by the list or by the container's count", () => {
    const many = Array.from({ length: VIDEO_MAX_STREAMS + 1 }, (_, index) => ({
      ...PHONE_HEVC_MOV.streams[1],
      index,
    }))
    expect(codeOf(() => assessProbe({ ...PHONE_HEVC_MOV, streams: many }, "mov"))).toBe(
      "video.unreadable"
    )
    expect(codeOf(() => assessProbe(phoneWith({}, { nb_streams: 999 }), "mov"))).toBe(
      "video.unreadable"
    )
  })

  it("refuses an answer from another demuxer than the one forced", () => {
    // Forced `-f mov`, an answer naming HLS or Matroska is not about our file
    expect(codeOf(() => assessProbe(phoneWith({}, { format_name: "hls" }), "mov"))).toBe(
      "video.unreadable"
    )
    expect(codeOf(() => assessProbe(VP9_WEBM, "mov"))).toBe("video.unreadable")
    expect(codeOf(() => assessProbe(PHONE_HEVC_MOV, "matroska"))).toBe("video.unreadable")
    expect(codeOf(() => assessProbe({ streams: PHONE_HEVC_MOV.streams }, "mov"))).toBe(
      "video.unreadable"
    )
  })

  it.each([
    ["not an object", "nope"],
    ["null", null],
    ["streams not a list", { streams: {}, format: PHONE_HEVC_MOV.format }],
    ["a width in text", phoneWith({ width: "1920" })],
    ["a huge duration text", phoneWith({ duration: "9".repeat(40) })],
    ["no streams", { streams: [], format: { format_name: "mov,mp4", duration: "1.0" } }],
  ])("refuses an answer that is not ffprobe's JSON: %s", (_, output) => {
    expect(codeOf(() => assessProbe(output, "mov"))).toBe("video.unreadable")
  })
})

describe("numbers ffprobe writes as text, read by hand", () => {
  it.each([
    ["12.345000", 12.345],
    ["0", 0],
    ["30", 30],
    [".5", 0.5],
  ])("reads %s", (text, value) => {
    expect(decimalOf(text)).toBe(value)
  })

  it.each(["", "N/A", "-1", "1e9", "1.2.3", "Infinity", "0x10", " 1", "1 ", "."])(
    "refuses %j",
    (text) => {
      expect(decimalOf(text)).toBeNull()
    }
  )

  it("reads rates, and nothing for 0/0, x/0 or garbage", () => {
    expect(rateOf("30000/1001")).toBeCloseTo(29.97, 2)
    expect(rateOf("25")).toBe(25)
    expect(rateOf("0/0")).toBeNull()
    expect(rateOf("30/0")).toBeNull()
    expect(rateOf("a/b")).toBeNull()
    expect(rateOf("1/2/3")).toBeNull()
    expect(rateOf(undefined)).toBeNull()
  })
})
