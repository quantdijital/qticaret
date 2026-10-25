import { logger } from "../../logging"
import { createVersionedCache } from "../versioned-cache"
import type { VersionSource } from "../versioned-cache"

function counter(): VersionSource & { value: number; fail: boolean } {
  const source = {
    value: 0,
    fail: false,
    current: () =>
      source.fail ? Promise.reject(new Error("redis down")) : Promise.resolve(String(source.value)),
    bump: () => {
      source.value += 1
      return Promise.resolve()
    },
  }
  return source
}

beforeEach(() => {
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("createVersionedCache", () => {
  it("serves the value from memory and checks the counter at most once a second", async () => {
    let now = 0
    const source = counter()
    const current = jest.spyOn(source, "current")
    const load = jest.fn(() => Promise.resolve("v1"))
    const cache = createVersionedCache({ load, source, name: "test", now: () => now })

    await cache.get()
    now = 500
    await cache.get()

    expect(load).toHaveBeenCalledTimes(1)
    expect(current).toHaveBeenCalledTimes(1)
  })

  it("reloads when another process moved the counter", async () => {
    let now = 0
    const source = counter()
    const load = jest.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new")
    const cache = createVersionedCache({ load, source, name: "test", now: () => now })

    expect(await cache.get()).toBe("old")
    source.value = 7
    now = 1_000

    expect(await cache.get()).toBe("new")
  })

  it("reloads at once after its own write", async () => {
    const source = counter()
    const load = jest.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new")
    const cache = createVersionedCache({ load, source, name: "test" })

    await cache.get()
    await cache.invalidate()

    expect(source.value).toBe(1)
    expect(await cache.get()).toBe("new")
  })

  it("reloads from the source of truth when the counter cannot be read", async () => {
    let now = 0
    const source = counter()
    const load = jest.fn(() => Promise.resolve("db"))
    const cache = createVersionedCache({ load, source, name: "test", now: () => now })

    await cache.get()
    source.fail = true
    now = 1_000
    await cache.get()

    expect(load).toHaveBeenCalledTimes(2)
  })

  it("works without a counter in a single process", async () => {
    const load = jest.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b")
    const cache = createVersionedCache({ load, source: null, name: "test" })

    expect(await cache.get()).toBe("a")
    expect(await cache.get()).toBe("a")
    await cache.invalidate()
    expect(await cache.get()).toBe("b")
  })

  it("shares one load among concurrent reads", async () => {
    const load = jest.fn(() => Promise.resolve("v"))
    const cache = createVersionedCache({ load, source: counter(), name: "test" })

    await Promise.all([cache.get(), cache.get(), cache.get()])

    expect(load).toHaveBeenCalledTimes(1)
  })

  it("reloads after maxAgeMs even when the marker did not change", async () => {
    let now = 0
    const load = jest.fn(() => Promise.resolve("v"))
    const cache = createVersionedCache({
      load,
      source: counter(),
      name: "test",
      maxAgeMs: 30_000,
      now: () => now,
    })

    await cache.get()
    now = 30_000
    await cache.get()

    expect(load).toHaveBeenCalledTimes(2)
  })

  it("does not keep a load that started before an invalidate", async () => {
    let release: (value: string) => void = () => undefined
    const load = jest
      .fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => (release = resolve)))
      .mockResolvedValueOnce("new")
    const cache = createVersionedCache({ load, source: null, name: "test" })

    const stale = cache.get()
    await new Promise((resolve) => setImmediate(resolve))
    await cache.invalidate()
    release("old")
    await stale

    expect(await cache.get()).toBe("new")
  })

  it("tries a failed marker write again on the next read", async () => {
    const source = counter()
    const bump = jest.spyOn(source, "bump").mockRejectedValueOnce(new Error("redis down"))
    const cache = createVersionedCache({ load: () => Promise.resolve("v"), source, name: "test" })

    await cache.invalidate()
    await cache.get()

    expect(bump).toHaveBeenCalledTimes(2)
  })
})
