import { PROBE_MAX_OUTPUT_BYTES, createSlots, probeArgs, probeVideo, runTool } from ".."
import { RetryableError } from "../../../errors"
import { fakeSpawn } from "./fake-spawn"
import { PHONE_HEVC_MOV, VP9_WEBM } from "./probe-fixtures"

const PATH = "/tmp/qt-video-AbC123/source"
const answer = (output: unknown) => ({ stdout: JSON.stringify(output) })

const codeOf = async (promise: Promise<unknown>): Promise<string | null> => {
  try {
    await promise
    return null
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage ?? (error as Error).message
  }
}

// A fresh limiter per test: the module's own is shared by the process
const slots = () =>
  createSlots({
    concurrency: 2,
    maxWaiting: 8,
    waitTimeoutMs: 1_000,
    busy: () => new RetryableError("video.upload_busy"),
  })

describe("ffprobe's argument list (adr/0069 §3)", () => {
  it("forces and allows the MOV demuxer alone, the file protocol only, bounds, and our path", () => {
    expect(probeArgs("mov", PATH)).toEqual([
      "-hide_banner",
      "-loglevel",
      "error",
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
      "-show_entries",
      "stream=index,codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,nb_frames,duration:stream_disposition=attached_pic:format=format_name,duration,nb_streams",
      "-of",
      "json",
      "-i",
      `file:${PATH}`,
    ])
  })

  it("forces and allows Matroska alone for WebM, with no MOV-only options", () => {
    const args = probeArgs("matroska", PATH)
    expect(
      args.slice(args.indexOf("-format_whitelist"), args.indexOf("-format_whitelist") + 2)
    ).toEqual(["-format_whitelist", "matroska"])
    expect(args.slice(args.indexOf("-f"), args.indexOf("-f") + 2)).toEqual(["-f", "matroska"])
    expect(args).not.toContain("-enable_drefs")
    expect(args.at(-1)).toBe(`file:${PATH}`)
  })

  it("puts every bound before the input, where ffprobe applies it to the input", () => {
    const args = probeArgs("mov", PATH)
    const input = args.indexOf("-i")
    for (const option of [
      "-codec_whitelist",
      "-max_streams",
      "-max_pixels",
      "-f",
      "-format_whitelist",
    ]) {
      expect(args.indexOf(option)).toBeGreaterThan(-1)
      expect(args.indexOf(option)).toBeLessThan(input)
    }
  })

  it("asks for no tags (places, devices, names) and nothing but our file", () => {
    const args = probeArgs("mov", PATH)
    expect(args.join(" ")).not.toMatch(/tags|show_format |show_streams|http|concat|subfile|data:/)
    expect(args.filter((arg) => arg.startsWith("file:"))).toEqual([`file:${PATH}`])
  })

  it.each(["source", "../source", "file:/tmp/x", "/tmp/a\nb", "/tmp/a\0b"])(
    "takes only an absolute path of ours: %j",
    (path) => {
      expect(() => probeArgs("mov", path)).toThrow()
    }
  )
})

describe("running ffprobe", () => {
  it("runs the program without a shell, stdin closed, in a bare environment", async () => {
    const { spawn, calls } = fakeSpawn(() => answer(PHONE_HEVC_MOV))
    await expect(probeVideo(PATH, "mov", { spawn, slots: slots(), env: {} })).resolves.toEqual({
      width: 1920,
      height: 1080,
      durationMs: 12_046,
    })
    const [call] = calls
    expect(call?.command).toBe("ffprobe")
    expect(call?.args).toEqual(probeArgs("mov", PATH))
    expect(call?.options).toMatchObject({ shell: false, stdio: ["ignore", "pipe", "pipe"] })
    expect(Object.keys(call?.options.env ?? {}).sort()).toEqual(["LC_ALL", "PATH"])
  })

  it("runs the program at FFPROBE_PATH when set", async () => {
    const { spawn, calls } = fakeSpawn(() => answer(VP9_WEBM))
    await probeVideo(PATH, "matroska", {
      spawn,
      slots: slots(),
      env: { FFPROBE_PATH: "/opt/ffmpeg/bin/ffprobe" },
    })
    expect(calls[0]?.command).toBe("/opt/ffmpeg/bin/ffprobe")
  })

  it("kills a run past its time with SIGKILL and refuses the clip", async () => {
    const { spawn, calls } = fakeSpawn(() => ({ hang: true }))
    expect(await codeOf(probeVideo(PATH, "mov", { spawn, slots: slots(), timeoutMs: 50 }))).toBe(
      "video.unreadable"
    )
    expect(calls[0]?.kill).toHaveBeenCalledWith("SIGKILL")
  })

  it("kills a run that answers too much and refuses the clip", async () => {
    const big = Buffer.alloc(PROBE_MAX_OUTPUT_BYTES + 1, 0x20)
    const { spawn, calls } = fakeSpawn(() => ({ stdout: big, hang: true }))
    expect(await codeOf(probeVideo(PATH, "mov", { spawn, slots: slots() }))).toBe(
      "video.unreadable"
    )
    expect(calls[0]?.kill).toHaveBeenCalledWith("SIGKILL")
  })

  it.each([
    ["a failed run", { stdout: "{}", code: 1 }],
    ["a crash", { code: 139 }],
    ["an answer that is not JSON", { stdout: "Invalid data found when processing input" }],
    ["an empty answer", { stdout: "" }],
    ["a JSON answer of another shape", { stdout: "[1,2,3]" }],
  ])("refuses the clip on %s", async (_, program) => {
    const { spawn } = fakeSpawn(() => program)
    expect(await codeOf(probeVideo(PATH, "mov", { spawn, slots: slots() }))).toBe(
      "video.unreadable"
    )
  })

  it("says uploads are unavailable when ffprobe cannot start", async () => {
    const { spawn } = fakeSpawn(() => ({ startError: "ENOENT" }))
    const failure = probeVideo(PATH, "mov", { spawn, slots: slots() })
    await expect(failure).rejects.toBeInstanceOf(RetryableError)
    expect(await codeOf(probeVideo(PATH, "mov", { spawn, slots: slots() }))).toBe(
      "video.upload_unavailable"
    )
  })

  it("frees its slot on every way out", async () => {
    const limiter = slots()
    for (const program of [
      { hang: true },
      { code: 1 },
      { startError: "ENOENT" },
      answer(VP9_WEBM),
    ]) {
      const { spawn } = fakeSpawn(() => program)
      await codeOf(probeVideo(PATH, "matroska", { spawn, slots: limiter, timeoutMs: 30 }))
    }
    expect(limiter.state()).toEqual({ running: 0, waiting: 0 })
  })

  it("refuses with 'busy' past its queue, and lets the waiting run when a slot frees", async () => {
    const limiter = createSlots({
      concurrency: 1,
      maxWaiting: 1,
      waitTimeoutMs: 5_000,
      busy: () => new RetryableError("video.upload_busy", { retryAfterMs: 10_000 }),
    })
    let finish: () => void = () => undefined
    const hold = limiter.take().then((release) => {
      finish = release
    })
    await hold
    const { spawn } = fakeSpawn(() => answer(VP9_WEBM))
    const waiting = probeVideo(PATH, "matroska", { spawn, slots: limiter })
    expect(await codeOf(probeVideo(PATH, "matroska", { spawn, slots: limiter }))).toBe(
      "video.upload_busy"
    )
    finish()
    await expect(waiting).resolves.toMatchObject({ width: 1280 })
  })
})

describe("the program runner", () => {
  it("reads at most what it may, then kills", async () => {
    const { spawn, calls } = fakeSpawn(() => ({ stdout: "x".repeat(100), hang: true }))
    const run = await runTool("prog", [], { timeoutMs: 5_000, maxOutputBytes: 10, spawn })
    expect(run).toMatchObject({ overflow: true, timedOut: false, signal: "SIGKILL" })
    expect(run.stdout.length).toBe(0)
    expect(calls[0]?.kill).toHaveBeenCalledTimes(1)
  })

  it("throws when the program cannot start", async () => {
    const { spawn } = fakeSpawn(() => ({ startError: "EACCES" }))
    await expect(
      runTool("prog", [], { timeoutMs: 1_000, maxOutputBytes: 10, spawn })
    ).rejects.toMatchObject({ name: "ToolStartError", code: "EACCES" })
  })

  it("throws when spawn itself throws", async () => {
    const spawn = () => {
      throw Object.assign(new Error("bad"), { code: "E2BIG" })
    }
    await expect(
      runTool("prog", [], { timeoutMs: 1_000, maxOutputBytes: 10, spawn })
    ).rejects.toMatchObject({ code: "E2BIG" })
  })
})
