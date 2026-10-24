import { CircuitBreaker } from "../circuit-breaker"
import { DEFAULT_RETRY_POLICY, backoffDelay, parseRetryAfter } from "../retry"
import { TransportRefusal, safeTransport } from "../transport"

describe("backoffDelay", () => {
  it("grows exponentially under full jitter and stops at the cap", () => {
    const max = () => 0.999999

    expect(backoffDelay(0, DEFAULT_RETRY_POLICY, max)).toBe(199)
    expect(backoffDelay(3, DEFAULT_RETRY_POLICY, max)).toBe(1599)
    expect(backoffDelay(20, DEFAULT_RETRY_POLICY, max)).toBe(4999)
    expect(backoffDelay(5, DEFAULT_RETRY_POLICY, () => 0)).toBe(0)
  })
})

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-10-24T12:00:00Z")

  it.each([
    ["seconds", "3", 3000],
    ["an HTTP date", "Sat, 24 Oct 2026 12:00:05 GMT", 5000],
    ["a date in the past", "Sat, 24 Oct 2026 11:00:00 GMT", 0],
  ])("reads %s", (_label, value, expected) => {
    expect(parseRetryAfter(value, now)).toBe(expected)
  })

  it.each([null, "", "soon", "-1"])("ignores %p", (value) => {
    expect(parseRetryAfter(value, now)).toBeUndefined()
  })
})

describe("CircuitBreaker", () => {
  it("moves from closed to open to half-open, one trial at a time", () => {
    let now = 0
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 }, () => now)

    breaker.recordFailure()
    expect(breaker.state).toBe("closed")
    breaker.recordFailure()
    expect(breaker.state).toBe("open")
    expect(breaker.acquire()).toBeNull()

    now = 100
    expect(breaker.state).toBe("half_open")
    expect(breaker.acquire()).toEqual({ trial: true })
    expect(breaker.acquire()).toBeNull()
  })

  it("reopens at once when the trial fails and closes when it succeeds", () => {
    let now = 0
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetAfterMs: 100 }, () => now)
    breaker.recordFailure()

    now = 100
    breaker.acquire()
    breaker.recordFailure()
    expect(breaker.state).toBe("open")

    now = 200
    breaker.acquire()
    breaker.recordSuccess()
    expect(breaker.state).toBe("closed")
  })

  it("lets another trial through once a trial gives its permit back", () => {
    let now = 0
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetAfterMs: 100 }, () => now)
    breaker.recordFailure()
    now = 100

    const permit = breaker.acquire()
    expect(breaker.acquire()).toBeNull()
    if (permit) {
      breaker.release(permit)
    }

    expect(breaker.acquire()).toEqual({ trial: true })
    expect(breaker.state).toBe("half_open")
  })

  it("forgets earlier failures after a success", () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 })

    breaker.recordFailure()
    breaker.recordSuccess()
    breaker.recordFailure()

    expect(breaker.state).toBe("closed")
  })
})

describe("safeTransport", () => {
  it("turns an SSRF refusal into a TransportRefusal", async () => {
    await expect(
      safeTransport({
        url: "http://127.0.0.1/hook",
        method: "POST",
        headers: {},
        timeoutMs: 1000,
        maxResponseBytes: 1000,
      })
    ).rejects.toBeInstanceOf(TransportRefusal)
  })
})
