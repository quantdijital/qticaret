import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, stat, truncate, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { probeVideo, readHead, videoSignature, videoToolPaths } from ".."
import type { VideoDemuxer } from ".."

/**
 * The real ffprobe on clips the real ffmpeg makes here (adr/0069 slice 1):
 * no video is kept in the repository. Without ffmpeg and ffprobe the suite
 * is skipped and says so; in CI (`CI` set) their absence fails it, so a
 * missing install step cannot pass quietly.
 */

jest.setTimeout(120_000)

const paths = videoToolPaths()
const answers = (command: string, args: string[]) =>
  spawnSync(command, args, { encoding: "utf8", timeout: 10_000 })
const present =
  answers(paths.ffprobe, ["-version"]).status === 0 &&
  answers(paths.ffmpeg, ["-version"]).status === 0
const encoders = present ? answers(paths.ffmpeg, ["-hide_banner", "-encoders"]).stdout : ""
const vp9 = encoders.includes(" libvpx-vp9 ")

if (!present) {
  process.stderr.write(
    "ffprobe yok: gerçek ffprobe testleri atlandı (ffmpeg ve ffprobe kurulmalı)\n"
  )
}

const describeReal = present ? describe : describe.skip

/** Runs ffmpeg with a lavfi source; throws on failure. */
function ffmpeg(args: string[]): void {
  const run = answers(paths.ffmpeg, ["-hide_banner", "-v", "error", "-y", ...args])
  if (run.status !== 0) {
    throw new Error(`ffmpeg failed: ${run.stderr}`)
  }
}

const source = (spec: string) => ["-f", "lavfi", "-i", spec]

describe("the test environment", () => {
  it("has ffmpeg and ffprobe in CI", () => {
    if (process.env["CI"]) {
      expect(present).toBe(true)
    }
  })
})

describeReal("the real ffprobe on made clips (adr/0069 §3)", () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "qt-video-test-"))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const at = (name: string) => join(dir, name)

  /** The upload's two gates: the signature, then ffprobe forced to its demuxer. */
  async function check(name: string) {
    const signature = videoSignature(await readHead(at(name)))
    if (!signature) {
      return { refused: "video.unsupported_type" }
    }
    try {
      return { signature, verdict: await probeVideo(at(name), signature.demuxer) }
    } catch (error) {
      return { refused: (error as { safeMessage?: string }).safeMessage }
    }
  }

  async function forced(name: string, demuxer: VideoDemuxer) {
    try {
      await probeVideo(at(name), demuxer)
      return null
    } catch (error) {
      return (error as { safeMessage?: string }).safeMessage
    }
  }

  it("takes a one-second MP4 and a MOV", async () => {
    ffmpeg([
      ...source("testsrc=size=160x120:rate=10:duration=1"),
      "-c:v",
      "mpeg4",
      "-movflags",
      "+faststart",
      at("ok.mp4"),
    ])
    ffmpeg([
      ...source("testsrc=size=160x120:rate=10:duration=1"),
      "-c:v",
      "mpeg4",
      "-f",
      "mov",
      at("ok.mov"),
    ])
    const mp4 = await check("ok.mp4")
    expect(mp4).toMatchObject({
      signature: { format: "mp4" },
      verdict: { width: 160, height: 120 },
    })
    expect((mp4 as { verdict: { durationMs: number } }).verdict.durationMs).toBeGreaterThan(900)
    expect(await check("ok.mov")).toMatchObject({ signature: { format: "mov" } })
  })

  ;(vp9 ? it : it.skip)("takes a WebM (VP9)", async () => {
    ffmpeg([
      ...source("testsrc=size=160x120:rate=10:duration=1"),
      "-c:v",
      "libvpx-vp9",
      "-deadline",
      "realtime",
      at("ok.webm"),
    ])
    expect(await check("ok.webm")).toMatchObject({
      signature: { format: "webm", demuxer: "matroska" },
      verdict: { width: 160, height: 120 },
    })
  })

  it("takes sound and more than one video stream, each within the rules", async () => {
    ffmpeg([
      ...source("testsrc=size=160x120:rate=10:duration=1"),
      ...source("testsrc2=size=96x64:rate=10:duration=1"),
      ...source("sine=frequency=440:duration=1"),
      "-map",
      "0:v",
      "-map",
      "1:v",
      "-map",
      "2:a",
      "-c:v",
      "mpeg4",
      "-c:a",
      "aac",
      at("multi.mp4"),
    ])
    expect(await check("multi.mp4")).toMatchObject({ verdict: { width: 160, height: 120 } })
  })

  it("refuses 17 streams", async () => {
    const maps = Array.from({ length: 17 }, () => ["-map", "0:v"]).flat()
    ffmpeg([
      ...source("testsrc=size=32x32:rate=5:duration=1"),
      ...maps,
      "-c:v",
      "mpeg4",
      at("many.mp4"),
    ])
    expect(await check("many.mp4")).toEqual({ refused: "video.unreadable" })
  })

  it("refuses 31 seconds, and a two-frame clip stretched to hours", async () => {
    ffmpeg([...source("testsrc=size=32x32:rate=1:duration=31"), "-c:v", "mpeg4", at("long.mp4")])
    expect(await check("long.mp4")).toEqual({ refused: "video.too_long" })
    ffmpeg([
      ...source("testsrc=size=32x32:rate=1:duration=2"),
      "-vf",
      "setpts=PTS*20000",
      "-c:v",
      "mpeg4",
      at("bomb.mp4"),
    ])
    expect(await check("bomb.mp4")).toEqual({ refused: "video.too_long" })
  })

  it("refuses a side past 4096 px, and 240 fps", async () => {
    ffmpeg([...source("color=size=4112x16:rate=1:duration=1"), "-c:v", "mpeg4", at("wide.mp4")])
    expect(await check("wide.mp4")).toEqual({ refused: "video.dimensions_too_large" })
    ffmpeg([...source("testsrc=size=32x32:rate=240:duration=0.2"), "-c:v", "mpeg4", at("fast.mp4")])
    expect(await check("fast.mp4")).toEqual({ refused: "video.frame_rate_too_high" })
  })

  it("refuses an AVI by its bytes, whatever it is called", async () => {
    ffmpeg([
      ...source("testsrc=size=32x32:rate=5:duration=1"),
      "-c:v",
      "mpeg4",
      "-f",
      "avi",
      at("avi.mp4"),
    ])
    expect(await check("avi.mp4")).toEqual({ refused: "video.unsupported_type" })
  })

  it("never follows an HLS playlist, a concat: or a subfile path, even forced to read it", async () => {
    const secret = at("secret.txt")
    await writeFile(secret, "gizli")
    const playlist = [
      "#EXTM3U",
      "#EXT-X-TARGETDURATION:1",
      "#EXTINF:1.0,",
      `concat:${secret}|subfile,,start,0,end,0,,:${secret}`,
      "#EXTINF:1.0,",
      `file://${secret}`,
      "#EXT-X-ENDLIST",
    ].join("\n")
    await writeFile(at("playlist.mp4"), playlist)
    await writeFile(at("concat.mp4"), `concat:${secret}|${secret}`)
    await writeFile(at("subfile.webm"), `subfile,,start,0,end,5,,:${secret}`)
    for (const name of ["playlist.mp4", "concat.mp4", "subfile.webm"]) {
      expect(await check(name)).toEqual({ refused: "video.unsupported_type" })
      // Past the signature by mistake: the forced demuxer reads it as a broken file
      expect(await forced(name, "mov")).toBe("video.unreadable")
      expect(await forced(name, "matroska")).toBe("video.unreadable")
    }
    expect(await readFile(secret, "utf8")).toBe("gizli")
  })

  it("refuses an MP4 cut off before its index", async () => {
    // Without faststart the index (moov) is written last: half the file has none
    ffmpeg([...source("testsrc=size=160x120:rate=10:duration=2"), "-c:v", "mpeg4", at("cut.mp4")])
    const { size } = await stat(at("cut.mp4"))
    await truncate(at("cut.mp4"), Math.floor(size / 2))
    expect(await check("cut.mp4")).toEqual({ refused: "video.unreadable" })
  })
})
