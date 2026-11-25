import {
  bodyReadsNow,
  bodyReadTuning,
  holdBodyRead,
  resetBodyReads,
  tuneBodyReads,
} from "../body-reads"
import {
  AI_GATEWAY_BODY_GRACE_MS,
  AI_GATEWAY_BODY_MIN_BYTES_PER_SECOND,
  AI_GATEWAY_MAX_BODY_READS,
  AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS,
} from "../limits"

/** One slot each from `count` different addresses. */
const fromMany = (count: number, prefix = "10.0.0.") =>
  Array.from({ length: count }, (_, index) => holdBodyRead(`${prefix}${String(index + 1)}`))

describe("the gateway's bodies read at once (P3b second review N2, third review O1)", () => {
  afterEach(() => {
    resetBodyReads()
    tuneBodyReads(null)
  })

  it("holds the process to its 16, whoever sends them", () => {
    expect(AI_GATEWAY_MAX_BODY_READS).toBe(16)
    const held = fromMany(AI_GATEWAY_MAX_BODY_READS)
    expect(held.every((slot) => slot !== null)).toBe(true)
    expect(holdBodyRead("10.0.1.1")).toBeNull()
    held[3]?.()
    expect(bodyReadsNow()).toBe(AI_GATEWAY_MAX_BODY_READS - 1)
    expect(holdBodyRead("10.0.1.1")).not.toBeNull()
    expect(holdBodyRead("10.0.1.2")).toBeNull()
  })

  it("holds one address to its four; another address still reads", () => {
    expect(AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS).toBe(4)
    const one = "203.0.113.7"
    const held = Array.from({ length: AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS }, () =>
      holdBodyRead(one)
    )
    expect(held.every((slot) => slot !== null)).toBe(true)
    expect(holdBodyRead(one)).toBeNull()
    expect(bodyReadsNow(one)).toBe(4)
    // Another address: its own four, the process far from its 16
    const other = holdBodyRead("2001:db8:0:1::/64")
    expect(other).not.toBeNull()
    expect(bodyReadsNow()).toBe(5)
    // One given back: the address reads again, and no more than four
    held[0]?.()
    expect(bodyReadsNow(one)).toBe(3)
    expect(holdBodyRead(one)).not.toBeNull()
    expect(holdBodyRead(one)).toBeNull()
  })

  it("gives a slot back once, however often it is given, the address forgotten at none", () => {
    const slot = holdBodyRead("198.51.100.1")
    const kept = holdBodyRead("198.51.100.1")
    slot?.()
    slot?.()
    expect([bodyReadsNow(), bodyReadsNow("198.51.100.1")]).toEqual([1, 1])
    kept?.()
    expect([bodyReadsNow(), bodyReadsNow("198.51.100.1")]).toEqual([0, 0])
  })

  it("takes a test's own limits and puts limits.ts's back", () => {
    tuneBodyReads({ perAddress: 1, graceMs: 100 })
    expect(holdBodyRead("192.0.2.1")).not.toBeNull()
    expect(holdBodyRead("192.0.2.1")).toBeNull()
    expect(bodyReadTuning().minBytesPerSecond).toBe(AI_GATEWAY_BODY_MIN_BYTES_PER_SECOND)
    tuneBodyReads(null)
    expect(bodyReadTuning()).toMatchObject({
      perAddress: AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS,
      graceMs: AI_GATEWAY_BODY_GRACE_MS,
      minBytesPerSecond: 32 * 1024,
    })
  })
})
