import { SafeFetchError } from "../../security/safe-fetch"
import type { SafeFetchResponse } from "../../security/safe-fetch"
import { FetchPace } from "../fetch-pace"
import {
  IMAGE_ATTEMPTS,
  ImageRefused,
  backoffMs,
  downloadImage,
  retryAfterMs,
  statusReason,
} from "../image-fetch"

const noWait = () => Promise.resolve()
const ADDRESS = "https://eski.example.com/wp-content/uploads/tava.webp"
const BYTES = Buffer.from("resim")

const answer = (status: number, headers: Record<string, string> = {}): SafeFetchResponse => ({
  status,
  headers,
  body: status === 200 ? BYTES : Buffer.alloc(0),
  url: ADDRESS,
})

/** A host answering in turn; the waits asked for kept. */
function host(...answers: (SafeFetchResponse | Error)[]) {
  const waits: number[] = []
  const safeFetch = jest.fn(() => {
    const next = answers.shift() ?? answer(200)
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  const deps = {
    safeFetch,
    sleep: (ms: number) => {
      waits.push(ms)
      return Promise.resolve()
    },
    random: () => 0.5,
  }
  return { deps, safeFetch, waits }
}

const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected a refusal")
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(ImageRefused)
      return (error as ImageRefused).key
    }
  )

describe("an old site's picture (adr/0042 Ek 2026-11-20)", () => {
  it.each([
    [404, "migration.image_unreachable_not_found", false],
    [410, "migration.image_unreachable_not_found", false],
    [403, "migration.image_unreachable_forbidden", false],
    [429, "migration.image_unreachable_throttled", true],
    [503, "migration.image_unreachable_server", true],
    [408, "migration.image_unreachable_timeout", true],
    [302, "migration.image_unreachable_status", false],
  ])("names a %i answer", (status, key, retryable) => {
    expect(statusReason(status)).toEqual({ key, retryable })
  })

  it("reads Retry-After as seconds or a date, capped", () => {
    const now = Date.parse("2026-11-20T10:00:00Z")
    expect(retryAfterMs("5", now)).toBe(5_000)
    expect(retryAfterMs("Fri, 20 Nov 2026 10:00:08 GMT", now)).toBe(8_000)
    expect(retryAfterMs("3600", now)).toBe(30_000)
    expect(retryAfterMs("yarın", now)).toBeNull()
    expect(retryAfterMs(undefined, now)).toBeNull()
  })

  it("waits longer each time, within its jitter, up to a cap", () => {
    expect([0, 1, 2].map((attempt) => backoffMs(attempt, () => 0))).toEqual([500, 1000, 2000])
    expect(backoffMs(1, () => 1)).toBe(2000)
    expect(backoffMs(20, () => 1)).toBe(30_000)
  })

  it("takes the picture after the host turned it away twice", async () => {
    const { deps, safeFetch, waits } = host(answer(429, { "retry-after": "3" }), answer(502))
    await expect(
      downloadImage(ADDRESS, undefined, new FetchPace(4, () => 0, noWait), deps)
    ).resolves.toEqual(BYTES)
    expect(safeFetch).toHaveBeenCalledTimes(3)
    // The host's own 3 s, then the jittered 1.5 s
    expect(waits).toEqual([3_000, 1_500])
  })

  it("gives up after its tries with the last reason", async () => {
    const { deps, safeFetch } = host(
      new SafeFetchError("timeout"),
      new SafeFetchError("request_failed"),
      answer(500),
      answer(503)
    )
    await expect(refusal(downloadImage(ADDRESS, undefined, undefined, deps))).resolves.toBe(
      "migration.image_unreachable_server"
    )
    expect(safeFetch).toHaveBeenCalledTimes(IMAGE_ATTEMPTS)
  })

  it.each([
    [new SafeFetchError("timeout"), "migration.image_unreachable_timeout"],
    [new SafeFetchError("dns_failed"), "migration.image_unreachable_network"],
    [new SafeFetchError("request_failed"), "migration.image_unreachable_network"],
  ])("tries a failing connection again and names it (%s)", async (error, key) => {
    const { deps, safeFetch } = host(error, error, error, error)
    await expect(refusal(downloadImage(ADDRESS, undefined, undefined, deps))).resolves.toBe(key)
    expect(safeFetch).toHaveBeenCalledTimes(IMAGE_ATTEMPTS)
  })

  it.each([
    [answer(404), "migration.image_unreachable_not_found"],
    [answer(403), "migration.image_unreachable_forbidden"],
    [new SafeFetchError("address_not_allowed"), "migration.image_address_refused"],
    [new SafeFetchError("response_too_large"), "migration.image_too_large"],
  ])("does not try again what the host refused for good", async (first, key) => {
    const { deps, safeFetch } = host(first)
    await expect(refusal(downloadImage(ADDRESS, undefined, undefined, deps))).resolves.toBe(key)
    expect(safeFetch).toHaveBeenCalledTimes(1)
  })

  it("reaches a fake provider's own origin with plain fetch, reasons kept", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    const key = await refusal(
      downloadImage(ADDRESS, "https://eski.example.com", undefined, {
        fetch,
        sleep: noWait,
      })
    )
    expect(key).toBe("migration.image_unreachable_not_found")
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe("the run's pace", () => {
  const instant = () => new FetchPace(4, () => 0, noWait)

  it("halves on each refusal down to one, and climbs back after a streak", () => {
    const pace = instant()
    pace.refused()
    expect(pace.current).toBe(2)
    pace.refused()
    pace.refused()
    expect(pace.current).toBe(1)
    for (let n = 0; n < 10; n++) {
      pace.succeeded()
    }
    expect(pace.current).toBe(2)
  })

  it("runs no more fetches side by side than it allows", async () => {
    const pace = instant()
    pace.refused()
    let running = 0
    let most = 0
    await Promise.all(
      Array.from({ length: 6 }, () =>
        pace.run(async () => {
          running += 1
          most = Math.max(most, running)
          await new Promise((resolve) => setTimeout(resolve, 1))
          running -= 1
        })
      )
    )
    expect(most).toBe(2)
  })

  it("holds every fetch through the wait the host asked for", async () => {
    let now = 1_000
    const waits: number[] = []
    const pace = new FetchPace(
      4,
      () => now,
      (ms) => {
        waits.push(ms)
        now += ms
        return Promise.resolve()
      }
    )
    pace.refused(5_000)
    await pace.run(() => Promise.resolve())
    await pace.run(() => Promise.resolve())
    expect(waits).toEqual([5_000])
  })
})
