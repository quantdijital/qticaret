import { describe, expect, it, vi } from "vitest"
import { shared } from "../shared"

describe("shared shop-wide answers", () => {
  it("asks once within the time, again after it", async () => {
    vi.useFakeTimers()
    const load = vi.fn(() => Promise.resolve("x"))
    await shared("a", load, 1000)
    await shared("a", load, 1000)
    expect(load).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1001)
    await shared("a", load, 1000)
    expect(load).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("does not keep a failure", async () => {
    const failing = vi.fn(() => Promise.reject(new Error("busy")))
    await expect(shared("b", failing)).rejects.toThrow("busy")
    await Promise.resolve()
    const ok = vi.fn(() => Promise.resolve("y"))
    await expect(shared("b", ok)).resolves.toBe("y")
  })
})
