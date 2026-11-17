import { spawnSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import {
  STRUCTURAL_TAGS,
  encodeActivity,
  makePoster,
  resetEncodeActivity,
  scaledSize,
  transcodeClip,
  videoToolPaths,
} from ".."
import type { VideoDemuxer } from ".."

/**
 * The real ffmpeg on clips made here (adr/0069 slice 2): a 30 s phone-like
 * MOV with a place and sound comes out as MP4 and WebM with neither, and a
 * poster; sizes follow the 720 px rule after rotation; two clips at once
 * never run two ffmpeg processes. Without ffmpeg (and its encoders) the
 * suite is skipped and says so; in CI their absence fails it.
 */

jest.setTimeout(300_000)

const paths = videoToolPaths()
const answers = (command: string, args: string[]) =>
  spawnSync(command, args, { encoding: "utf8", timeout: 10_000 })
const encoders =
  answers(paths.ffprobe, ["-version"]).status === 0
    ? answers(paths.ffmpeg, ["-hide_banner", "-encoders"]).stdout
    : ""
const present = encoders.includes(" libx264 ") && encoders.includes(" libvpx-vp9 ")

if (!present) {
  process.stderr.write(
    "ffmpeg yok: gerçek dönüştürme testleri atlandı (ffmpeg, libx264 ve libvpx-vp9 gerekli)\n"
  )
}

const describeReal = present ? describe : describe.skip

function ffmpeg(args: string[]): void {
  const run = answers(paths.ffmpeg, ["-hide_banner", "-v", "error", "-y", ...args])
  if (run.status !== 0) {
    throw new Error(`ffmpeg failed: ${run.stderr}`)
  }
}

interface Probed {
  streams: { codec_type: string; width?: number; height?: number; tags?: Record<string, string> }[]
  format: { duration: string; tags?: Record<string, string> }
}

function probe(path: string): Probed {
  const run = answers(paths.ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height:stream_tags:format=duration:format_tags",
    "-of",
    "json",
    path,
  ])
  return JSON.parse(run.stdout) as Probed
}

const lavfi = (spec: string) => ["-f", "lavfi", "-i", spec]

describe("the test environment", () => {
  it("has ffmpeg with libx264 and libvpx-vp9 in CI", () => {
    if (process.env["CI"]) {
      expect(present).toBe(true)
    }
  })
})

describeReal("the real transcoding (adr/0069 §4)", () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "qt-video-test-"))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function made(name: string, args: string[], demuxer: VideoDemuxer = "mov") {
    const source = join(dir, name)
    ffmpeg([...args, source])
    const work = await mkdtemp(join(dir, "work-"))
    return transcodeClip(source, demuxer, work)
  }

  it("makes a 30 s MOV with a place and sound into MP4 and WebM without either", async () => {
    const started = Date.now()
    const clip = await made("telefon.mov", [
      ...lavfi("testsrc2=size=1920x1080:rate=30:duration=30"),
      ...lavfi("sine=frequency=440:duration=30"),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-c:a",
      "aac",
      "-metadata",
      "location=+41.0082+028.9784/",
      "-metadata",
      "com.apple.quicktime.location.ISO6709=+41.0082+028.9784/",
      "-metadata",
      "creation_time=2026-11-01T10:00:00Z",
      "-metadata",
      "com.apple.quicktime.model=iPhone",
      "-movflags",
      "use_metadata_tags",
      "-f",
      "mov",
    ])
    process.stderr.write(
      `30 sn 1080p MOV → MP4 + WebM + kapak: ${String(Date.now() - started)} ms\n`
    )
    expect(clip.source).toMatchObject({ width: 1920, height: 1080 })
    for (const kind of ["mp4", "webm"] as const) {
      const output = clip.outputs[kind]
      expect(output).toMatchObject({ width: 1280, height: 720 })
      expect(output.durationMs).toBeLessThanOrEqual(30_100)
      expect(output.bytes).toBeGreaterThan(0)
      const read = probe(output.path)
      expect(read.streams.map((stream) => stream.codec_type)).toEqual(["video"])
      const tags = [
        ...Object.keys(read.format.tags ?? {}),
        ...read.streams.flatMap((stream) => Object.keys(stream.tags ?? {})),
      ]
      expect(tags.filter((tag) => !STRUCTURAL_TAGS.has(tag))).toEqual([])
      expect(JSON.stringify(read)).not.toMatch(/41\.0082|iPhone|2026-11-01|location/i)
    }
    const poster = await makePoster(clip.poster)
    expect(poster.master).toMatchObject({ width: 1280, height: 720 })
    const meta = await sharp(poster.master.buffer).metadata()
    expect(meta.format).toBe("jpeg")
    expect(meta.exif).toBeUndefined()
    expect(poster.derivatives.map((each) => `${each.format}-${String(each.width)}`)).toEqual(
      expect.arrayContaining(["webp-400", "avif-800", "webp-1280", "jpeg-1200"])
    )
  })

  it("turns a portrait phone clip upright and keeps small clips their own size", async () => {
    // A landscape picture given a 90° display matrix as a phone records it: shown as
    // 1080 × 1920 (stream copy keeps the pixels and writes the matrix)
    const landscape = join(dir, "yatay.mov")
    ffmpeg([
      ...lavfi("testsrc=size=1920x1080:rate=10:duration=1"),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-f",
      "mov",
      landscape,
    ])
    const turned = await made("dik.mov", [
      "-display_rotation",
      "90",
      "-i",
      landscape,
      "-c",
      "copy",
      "-f",
      "mov",
    ])
    expect(turned.source).toMatchObject({ width: 1920, height: 1080 })
    expect(turned.outputs.mp4).toMatchObject(scaledSize(1080, 1920))
    expect(turned.outputs.mp4).toMatchObject({ width: 720, height: 1280 })

    const small = await made(
      "kucuk.webm",
      [...lavfi("testsrc=size=321x241:rate=10:duration=1"), "-c:v", "libvpx-vp9", "-f", "webm"],
      "matroska"
    )
    expect(small.outputs.webm).toMatchObject(scaledSize(321, 241))
    expect(small.outputs.webm).toMatchObject({ width: 320, height: 240 })
  })

  it("takes the frame at 1 s for the poster when the first is black", async () => {
    const clip = await made("karanlik.mp4", [
      ...lavfi("testsrc=size=320x240:rate=10:duration=3"),
      "-vf",
      "fade=t=in:st=0:d=0.5",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-f",
      "mp4",
    ])
    const { channels } = await sharp(clip.poster).stats()
    expect(channels[0]?.mean ?? 0).toBeGreaterThan(30)
  })

  it("never runs two ffmpeg processes at once", async () => {
    resetEncodeActivity()
    const args = (size: string) => [
      ...lavfi(`testsrc=size=${size}:rate=10:duration=2`),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-f",
      "mp4",
    ]
    const [first, second] = await Promise.all([
      made("bir.mp4", args("320x240")),
      made("iki.mp4", args("240x320")),
    ])
    expect(first.outputs.mp4).toMatchObject({ width: 320, height: 240 })
    expect(second.outputs.mp4).toMatchObject({ width: 240, height: 320 })
    expect(encodeActivity()).toEqual({ running: 0, peak: 1 })
  })
})
