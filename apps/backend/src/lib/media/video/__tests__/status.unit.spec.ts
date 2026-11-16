import { canMoveVideo, openingStatus } from ".."
import type { VideoStatus } from ".."

const ALL: VideoStatus[] = ["uploaded", "processing", "ready", "failed"]

describe("a video's states (adr/0069 §1, §4)", () => {
  it("opens a clip waiting for the job, a YouTube link ready", () => {
    expect(openingStatus("upload")).toBe("uploaded")
    expect(openingStatus("youtube")).toBe("ready")
  })

  it("allows exactly the job's, the sweeper's and a retry's moves", () => {
    const allowed = ALL.flatMap((from) =>
      ALL.filter((to) => canMoveVideo(from, to)).map((to) => `${from} → ${to}`)
    )
    expect(allowed).toEqual([
      "uploaded → processing",
      "processing → uploaded",
      "processing → ready",
      "processing → failed",
      "failed → uploaded",
    ])
  })

  it("never leaves ready, never skips the job, never stays put", () => {
    for (const to of ALL) {
      expect(canMoveVideo("ready", to)).toBe(false)
    }
    expect(canMoveVideo("uploaded", "ready")).toBe(false)
    expect(canMoveVideo("failed", "ready")).toBe(false)
    for (const state of ALL) {
      expect(canMoveVideo(state, state)).toBe(false)
    }
  })
})
