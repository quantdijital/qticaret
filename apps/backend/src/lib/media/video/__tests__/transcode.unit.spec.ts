import { writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import { PROCESSING_FAILED, classifyFailure, createSlots, transcodeClip } from ".."
import type { FakeProgram } from "./fake-spawn"
import { fakeSpawn } from "./fake-spawn"

/**
 * The transcoding run with stand-in programs (adr/0069 §4): the order of
 * the passes, the priority they get, and which failure is the clip's
 * (fails at once) and which the machine's (tried again).
 */

const SOURCE_ANSWER = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_type: "video",
      codec_name: "h264",
      width: 1920,
      height: 1080,
      avg_frame_rate: "30/1",
      r_frame_rate: "30/1",
      duration: "10.000000",
      nb_frames: "300",
    },
  ],
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "10.000000", nb_streams: 1 },
})

const outputAnswer = (codec: string, container: string) =>
  JSON.stringify({
    streams: [
      {
        index: 0,
        codec_type: "video",
        codec_name: codec,
        width: 1280,
        height: 720,
        duration: "10",
      },
    ],
    format: { format_name: container, duration: "10.000000", tags: {} },
  })

let png: Buffer
let dir: string

beforeAll(async () => {
  png = await sharp({
    create: { width: 64, height: 36, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .png()
    .toBuffer()
})

beforeEach(async () => {
  dir = await mkdtemp(join(os.tmpdir(), "qt-video-test-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
  jest.restoreAllMocks()
})

/** Programs that work: each ffmpeg pass writes its output, each ffprobe answers for its file. */
function healthy(overrides: (args: readonly string[]) => FakeProgram | null = () => null) {
  return fakeSpawn((command, args) => {
    const override = overrides(args)
    if (override) {
      return override
    }
    const target = (args[args.length - 1] ?? "").replace(/^file:/, "")
    if (command === "ffmpeg" || command.endsWith("/nice")) {
      writeFileSync(target, target.endsWith(".png") ? png : Buffer.alloc(1000, 1))
      return {}
    }
    if (target.endsWith("output.mp4")) {
      return { stdout: outputAnswer("h264", "mov,mp4,m4a,3gp,3g2,mj2") }
    }
    if (target.endsWith("output.webm")) {
      return { stdout: outputAnswer("vp9", "matroska,webm") }
    }
    return { stdout: SOURCE_ANSWER }
  })
}

const env = { FFMPEG_PATH: "ffmpeg", FFPROBE_PATH: "ffprobe" }
const slots = () =>
  createSlots({ concurrency: 1, maxWaiting: 1, waitTimeoutMs: 1000, busy: () => new Error("busy") })

const failureOf = async (run: Promise<unknown>) => {
  try {
    await run
  } catch (error) {
    return { failure: classifyFailure(error), message: (error as Error).message }
  }
  throw new Error("expected a failure")
}

describe("a clip through the job", () => {
  it("probes, makes and checks the MP4, then the WebM, then takes the poster, each at low priority", async () => {
    const priority = jest.spyOn(os, "setPriority").mockImplementation(() => undefined)
    const { spawn, calls } = healthy()
    const source = join(dir, "source")
    const clip = await transcodeClip(source, "mov", dir, { spawn, env, slots: slots(), nice: null })
    expect(calls.map((call) => `${call.command} ${call.args.at(-1) ?? ""}`)).toEqual([
      `ffprobe file:${source}`,
      `ffmpeg file:${join(dir, "output.mp4")}`,
      `ffprobe file:${join(dir, "output.mp4")}`,
      `ffmpeg file:${join(dir, "output.webm")}`,
      `ffprobe file:${join(dir, "output.webm")}`,
      `ffmpeg file:${join(dir, "poster.png")}`,
    ])
    expect(calls.every((call) => call.options.shell === false)).toBe(true)
    expect(clip.source).toEqual({ width: 1920, height: 1080, durationMs: 10_000 })
    expect(clip.outputs.mp4).toMatchObject({ width: 1280, height: 720, bytes: 1000 })
    expect(clip.poster.equals(png)).toBe(true)
    // Every program after the source's probe (which runs in the upload's own limiter) at 19
    expect(priority).toHaveBeenCalledTimes(5)
    expect(priority.mock.calls.every(([, value]) => value === 19)).toBe(true)
  })

  it("starts ffmpeg under nice -n 19 where there is one, and ffprobe as it is", async () => {
    const { spawn, calls } = healthy()
    await transcodeClip(join(dir, "source"), "mov", dir, {
      spawn,
      env,
      slots: slots(),
      nice: "/usr/bin/nice",
    })
    const encodes = calls.filter((call) => call.command === "/usr/bin/nice")
    expect(encodes).toHaveLength(3)
    expect(encodes.every((call) => call.args.slice(0, 3).join(" ") === "-n 19 ffmpeg")).toBe(true)
    expect(calls.filter((call) => call.command === "ffprobe")).toHaveLength(3)
    expect(calls.filter((call) => call.command === "ffmpeg")).toEqual([])
  })

  it("fails the clip at once when ffprobe refuses it", async () => {
    const { spawn, calls } = healthy((args) =>
      args.at(-1)?.endsWith("source")
        ? { stdout: JSON.stringify({ streams: [], format: { format_name: "mov" } }) }
        : null
    )
    const { failure } = await failureOf(
      transcodeClip(join(dir, "source"), "mov", dir, { spawn, env, slots: slots(), nice: null })
    )
    expect(failure).toEqual({ kind: "input", code: "video.unreadable" })
    expect(calls.filter((call) => call.command === "ffmpeg")).toEqual([])
  })

  it("tries again when ffmpeg crashes or will not start", async () => {
    const crashed = healthy((args) => (args.includes("libx264") ? { code: 1 } : null))
    expect(
      (
        await failureOf(
          transcodeClip(join(dir, "source"), "mov", dir, {
            spawn: crashed.spawn,
            env,
            slots: slots(),
            nice: null,
          })
        )
      ).failure
    ).toEqual({ kind: "infra", code: PROCESSING_FAILED })

    const missing = healthy((args) => (args.includes("libx264") ? { startError: "ENOENT" } : null))
    expect(
      (
        await failureOf(
          transcodeClip(join(dir, "source"), "mov", dir, {
            spawn: missing.spawn,
            env,
            slots: slots(),
            nice: null,
          })
        )
      ).failure
    ).toEqual({ kind: "infra", code: PROCESSING_FAILED })
  })

  it("kills a pass past its time, and every pass once the job's signal fires", async () => {
    const slow = healthy((args) => (args.includes("libx264") ? { hang: true } : null))
    const timedOut = await failureOf(
      transcodeClip(join(dir, "source"), "mov", dir, {
        spawn: slow.spawn,
        env,
        slots: slots(),
        nice: null,
        passTimeoutMs: 50,
      })
    )
    expect(timedOut.failure.kind).toBe("infra")
    expect(timedOut.message).toContain("past its time")
    expect(slow.calls.find((call) => call.command === "ffmpeg")?.kill).toHaveBeenCalledWith(
      "SIGKILL"
    )

    const stopped = healthy((args) => (args.includes("libvpx-vp9") ? { hang: true } : null))
    const controller = new AbortController()
    const run = transcodeClip(join(dir, "source"), "mov", dir, {
      spawn: stopped.spawn,
      env,
      slots: slots(),
      nice: null,
      signal: controller.signal,
    })
    setTimeout(() => {
      controller.abort()
    }, 50)
    const aborted = await failureOf(run)
    expect(aborted.failure.kind).toBe("infra")
    expect(aborted.message).toContain("stopped")
    // The WebM pass was killed; the poster's never started
    expect(stopped.calls.filter((call) => call.command === "ffmpeg")).toHaveLength(2)
  })

  it("refuses an output that kept a tag the source carried", async () => {
    const leaky = healthy((args) =>
      args.at(-1)?.endsWith("output.mp4") && args.includes("-show_entries")
        ? {
            stdout: JSON.stringify({
              streams: [
                { index: 0, codec_type: "video", codec_name: "h264", width: 1280, height: 720 },
              ],
              format: {
                format_name: "mov,mp4",
                duration: "10.0",
                tags: { location: "+41.0082+028.9784/" },
              },
            }),
          }
        : null
    )
    const { failure, message } = await failureOf(
      transcodeClip(join(dir, "source"), "mov", dir, {
        spawn: leaky.spawn,
        env,
        slots: slots(),
        nice: null,
      })
    )
    expect(failure.kind).toBe("infra")
    expect(message).toContain("tags location")
  })
})
