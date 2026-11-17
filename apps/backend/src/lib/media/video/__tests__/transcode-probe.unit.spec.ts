import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ProbeStoppedError, classifyFailure, probeVideo, transcodeClip } from ".."
import { fakeSpawn } from "./fake-spawn"
import { fakeEnv, healthyPrograms, posterPng, testSlots } from "./transcode-fakes"

/**
 * The job's ffprobe of the source (adr/0069 §4, re-review 2): it has a
 * slot of its own, so uploads filling theirs never cost a good clip a
 * try, and it stops with the job's signal as the encoding passes do.
 */

jest.setTimeout(30_000)

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qt-video-test-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("the job's ffprobe of the source", () => {
  it("is not refused when the uploads' probes fill their pool", async () => {
    // Uploads' probes, two running and eight waiting, each hanging until killed at 400 ms
    const hung = fakeSpawn(() => ({ hang: true }))
    const uploads = Array.from({ length: 10 }, () =>
      probeVideo("/tmp/qt-video-x/source", "mov", {
        spawn: hung.spawn,
        env: fakeEnv,
        timeoutMs: 400,
      }).catch((error: unknown) => error)
    )
    // The pool is full: one more upload would be told to come back
    const turnedAway = await probeVideo("/tmp/qt-video-x/source", "mov", {
      spawn: hung.spawn,
      env: fakeEnv,
    }).catch((error: unknown) => error)
    expect((turnedAway as Error).message).toContain("video.upload_busy")

    const programs = healthyPrograms(await posterPng())
    const clip = await transcodeClip(join(dir, "source"), "mov", dir, {
      spawn: programs.spawn,
      env: fakeEnv,
      slots: testSlots(),
      nice: null,
    })
    expect(clip.outputs.mp4).toMatchObject({ width: 1280, height: 720 })
    await Promise.all(uploads)
  })

  it("stops with the job's signal, a try of the machine's", async () => {
    const programs = healthyPrograms(await posterPng())
    const controller = new AbortController()
    controller.abort()
    const stopped = await transcodeClip(join(dir, "source"), "mov", dir, {
      spawn: programs.spawn,
      env: fakeEnv,
      slots: testSlots(),
      nice: null,
      signal: controller.signal,
    }).catch((error: unknown) => error)
    expect(stopped).toBeInstanceOf(ProbeStoppedError)
    expect(classifyFailure(stopped).kind).toBe("infra")
    // Nothing was started
    expect(programs.calls).toEqual([])
  })
})
