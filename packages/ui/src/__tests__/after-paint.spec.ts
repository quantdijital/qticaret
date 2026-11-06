import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { afterPaint, PAINTLESS_WAIT_MS } from "../lib/after-paint"

/** `afterPaint`: the work runs after the next frame, once, or after a short wait without frames. */

let frames: FrameRequestCallback[] = []

beforeEach(() => {
  vi.useFakeTimers()
  frames = []
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function drawFrame() {
  const due = frames
  frames = []
  due.forEach((callback) => {
    callback(0)
  })
}

describe("afterPaint", () => {
  it("waits for the next frame, then for a task of its own", () => {
    const work = vi.fn()
    afterPaint(work)
    vi.advanceTimersByTime(0)
    expect(work).not.toHaveBeenCalled()
    drawFrame()
    expect(work).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it("runs once, even when the wait for a page without frames ends too", () => {
    const work = vi.fn()
    afterPaint(work)
    drawFrame()
    vi.advanceTimersByTime(PAINTLESS_WAIT_MS * 2)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it("runs after a short wait when no frame comes (a hidden tab)", () => {
    const work = vi.fn()
    afterPaint(work)
    vi.advanceTimersByTime(PAINTLESS_WAIT_MS - 1)
    expect(work).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(work).toHaveBeenCalledTimes(1)
  })
})
