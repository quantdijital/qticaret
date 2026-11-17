import { MedusaError } from "@medusajs/framework/utils"
import type MediaModuleService from "../../../../modules/media/service"
import { watchJob } from "../watch"

/**
 * A clip's job watched (adr/0069 §4): the heartbeat stops the job when the
 * video is gone or the lock went elsewhere, and `stop` never waits long on
 * a heartbeat that hangs (re-review 1).
 */

const video = {
  id: "mvid_01TEST",
  source_file_id: "video-kaynak.mov",
  source_format: "mov" as const,
  source_bytes: 1000,
  attempts: 0,
  retry_from: 0,
}

/** A media service whose heartbeat answers as `beatVideo` does; `beat` records the calls. */
function mediaWith(beatVideo: () => Promise<boolean>) {
  const beat = jest.fn(beatVideo)
  return { media: { beatVideo: beat } as unknown as MediaModuleService, beat }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("a clip's job watched", () => {
  it("beats with the claim's attempts and holds the lock on", async () => {
    const { media, beat } = mediaWith(() => Promise.resolve(true))
    const keepLock = jest.fn(() => Promise.resolve())
    const watch = watchJob(media, video, { heartbeatMs: 10, jobTimeoutMs: 10_000, keepLock })
    await wait(45)
    await watch.stop()
    expect(beat).toHaveBeenCalledWith("mvid_01TEST", 0)
    expect(keepLock).toHaveBeenCalled()
    expect(watch.signal.aborted).toBe(false)
    // Stopped: no beat after
    const beats = beat.mock.calls.length
    await wait(30)
    expect(beat.mock.calls.length).toBe(beats)
  })

  it("stops the job when the video is no longer its, or the lock went elsewhere", async () => {
    const gone = watchJob(mediaWith(() => Promise.resolve(false)).media, video, {
      heartbeatMs: 10,
      jobTimeoutMs: 10_000,
    })
    await wait(30)
    expect(gone.signal.aborted).toBe(true)
    expect(gone.state.gone).toBe(true)
    await gone.stop()

    const lost = watchJob(mediaWith(() => Promise.resolve(true)).media, video, {
      heartbeatMs: 10,
      jobTimeoutMs: 10_000,
      keepLock: () =>
        Promise.reject(new MedusaError(MedusaError.Types.CONFLICT, "Failed to acquire lock")),
    })
    await wait(30)
    expect(lost.signal.aborted).toBe(true)
    expect(lost.state.lockLost).toBe(true)
    await lost.stop()
  })

  it("stops the job at its time", async () => {
    const watch = watchJob(mediaWith(() => Promise.resolve(true)).media, video, {
      heartbeatMs: 1000,
      jobTimeoutMs: 20,
    })
    await wait(40)
    expect(watch.signal.aborted).toBe(true)
    await watch.stop()
  })

  it("does not wait long for a heartbeat that hangs", async () => {
    const hanging = mediaWith(() => new Promise<boolean>(() => undefined))
    const watch = watchJob(hanging.media, video, {
      heartbeatMs: 10,
      jobTimeoutMs: 10_000,
      stopWaitMs: 50,
    })
    await wait(25)
    expect(hanging.beat).toHaveBeenCalledTimes(1)
    const started = Date.now()
    await watch.stop()
    expect(Date.now() - started).toBeLessThan(1000)
  })
})
