import { writeFileSync } from "node:fs"
import sharp from "sharp"
import { createSlots } from ".."
import type { FakeProgram } from "./fake-spawn"
import { fakeSpawn } from "./fake-spawn"

/** Stand-in ffmpeg and ffprobe for the transcoding run's unit tests (adr/0069 §4). */

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

/** A small bright PNG: the poster's frame ffmpeg would write. */
export const posterPng = (): Promise<Buffer> =>
  sharp({ create: { width: 64, height: 36, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .png()
    .toBuffer()

/** Programs that work: each ffmpeg pass writes its output, each ffprobe answers for its file. */
export function healthyPrograms(
  png: Buffer,
  overrides: (args: readonly string[]) => FakeProgram | null = () => null
) {
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

export const fakeEnv = { FFMPEG_PATH: "ffmpeg", FFPROBE_PATH: "ffprobe" }

/** A limiter of its own for one test. */
export const testSlots = () =>
  createSlots({ concurrency: 1, maxWaiting: 1, waitTimeoutMs: 1000, busy: () => new Error("busy") })
