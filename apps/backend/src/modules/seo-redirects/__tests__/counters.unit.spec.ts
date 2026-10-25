import { createCounterBuffer } from "../counters"
import type { CounterRow } from "../counters"

// Writes start on the promise chain, a few microtasks after they are queued
const settle = () => new Promise((resolve) => setImmediate(resolve))

describe("createCounterBuffer", () => {
  let now = 0
  let written: CounterRow[][] = []
  const buffer = (maxKeys = 10) =>
    createCounterBuffer({
      name: "test",
      everyMs: 1_000,
      maxKeys,
      now: () => now,
      write: (rows) => {
        written.push(rows)
        return Promise.resolve()
      },
    })

  beforeEach(() => {
    now = 0
    written = []
  })

  it("sums a key's counts and keeps its last detail until flushed", async () => {
    const counts = buffer()
    counts.add("/a", "google.com")
    counts.add("/a", null)
    counts.add("/b")
    expect(written).toHaveLength(0)

    await counts.flush()
    expect(written[0]).toEqual([
      { key: "/a", count: 2, last: new Date(0), detail: "google.com" },
      { key: "/b", count: 1, last: new Date(0), detail: null },
    ])
  })

  it("writes on its own once the oldest count is old enough", async () => {
    const counts = buffer()
    counts.add("/a")
    now = 1_000
    counts.add("/b")
    await counts.flush()
    expect(written.map((rows) => rows.map(({ key }) => key))).toEqual([["/a", "/b"]])
  })

  it("writes at the key limit and drops new keys while that write runs", async () => {
    let release: () => void = () => undefined
    const counts = createCounterBuffer({
      name: "test",
      everyMs: 1_000,
      maxKeys: 2,
      now: () => now,
      write: (rows) => {
        written.push(rows)
        return new Promise<void>((resolve) => {
          release = resolve
        })
      },
    })
    counts.add("/a")
    counts.add("/b")
    counts.add("/c")
    counts.add("/d")
    counts.add("/e")
    counts.add("/c")
    await settle()
    expect(written.map((rows) => rows.map(({ key }) => key))).toEqual([["/a", "/b"]])
    release()
    const done = counts.flush()
    await settle()
    release()
    await done
    expect(written.map((rows) => rows.map(({ key, count }) => `${key}:${String(count)}`))).toEqual([
      ["/a:1", "/b:1"],
      ["/c:2", "/d:1"],
    ])
  })

  it("writes what it holds after everyMs even when no request comes", async () => {
    jest.useFakeTimers()
    try {
      const counts = buffer()
      counts.add("/a")
      await jest.advanceTimersByTimeAsync(999)
      expect(written).toHaveLength(0)
      await jest.advanceTimersByTimeAsync(1)
      expect(written.map((rows) => rows.map(({ key }) => key))).toEqual([["/a"]])
    } finally {
      jest.useRealTimers()
    }
  })

  it("survives a failed write", async () => {
    const counts = createCounterBuffer({
      name: "test",
      everyMs: 1_000,
      maxKeys: 10,
      write: () => Promise.reject(new Error("db down")),
    })
    counts.add("/a")
    await expect(counts.flush()).resolves.toBeUndefined()
  })
})
