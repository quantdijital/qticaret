import { bodyReadsNow, holdBodyRead, resetBodyReads } from "../body-reads"
import { AI_GATEWAY_MAX_BODY_READS } from "../limits"

describe("the gateway's bodies read at once (P3b second review N2)", () => {
  afterEach(() => {
    resetBodyReads()
  })

  it("holds the process to its 16, whoever sends them", () => {
    expect(AI_GATEWAY_MAX_BODY_READS).toBe(16)
    const held = Array.from({ length: AI_GATEWAY_MAX_BODY_READS }, () => holdBodyRead())
    expect(held.every((slot) => slot !== null)).toBe(true)
    expect(holdBodyRead()).toBeNull()
    held[3]?.()
    expect(bodyReadsNow()).toBe(AI_GATEWAY_MAX_BODY_READS - 1)
    expect(holdBodyRead()).not.toBeNull()
    expect(holdBodyRead()).toBeNull()
  })

  it("gives a slot back once, however often it is given", () => {
    const slot = holdBodyRead()
    slot?.()
    slot?.()
    expect(bodyReadsNow()).toBe(0)
  })
})
